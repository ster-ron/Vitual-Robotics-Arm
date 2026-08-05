// src/simulation/interpreter.js
import { VirtualArduino } from './virtualArduino';
import { useStore } from '../store/armStore';

let executionContext = null;
let isRunning = false;

export function stopExecution() {
  isRunning = false;
  if (executionContext) {
    executionContext = null;
  }
}

export async function runArduinoCode(code, logCallback) {
  isRunning = true;
  const board = new VirtualArduino(logCallback);
  const store = useStore.getState();

  // Create a sandboxed environment
  const context = {
    board,
    Serial: board.Serial,
    Servo: board.Servo,
    delay: board.delay.bind(board),
    delayMicroseconds: board.delayMicroseconds.bind(board),
    pinMode: board.pinMode.bind(board),
    digitalWrite: board.digitalWrite.bind(board),
    digitalRead: board.digitalRead.bind(board),
    analogWrite: board.analogWrite.bind(board),
    analogRead: board.analogRead.bind(board),
    
    // Constants
    INPUT: 'INPUT',
    OUTPUT: 'OUTPUT',
    INPUT_PULLUP: 'INPUT_PULLUP',
    HIGH: 1,
    LOW: 0,
    PI: Math.PI,
    
    // Store access for arm control
    __store: store,
    __setAngle: (joint, angle) => store.setAngle(joint, angle),
  };

  executionContext = context;

  // Parse and prepare the code
  const preparedCode = prepareArduinoCode(code);
  
  try {
    // Execute in a controlled environment
    const asyncWrapper = new Function(
      ...Object.keys(context),
      `
        try {
          ${preparedCode}
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      `
    );

    const result = await Promise.race([
      asyncWrapper(...Object.values(context)),
      new Promise((_, reject) => {
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Execution timeout (30s)')), 30000);
      })
    ]);

    if (!result.success) {
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    logCallback(`❌ ${error.message}`, 'error');
    throw error;
  } finally {
    isRunning = false;
    executionContext = null;
  }
}

function prepareArduinoCode(code) {
  // Remove comments
  let cleaned = code.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Convert Arduino functions to JS equivalents
  const conversions = {
    'Serial.begin': 'Serial.begin',
    'Serial.print': 'Serial.print',
    'Serial.println': 'Serial.println',
    'Serial.available': 'Serial.available',
    'Serial.read': 'Serial.read',
    'Serial.write': 'Serial.write',
    
    // Servo
    'myservo.attach': 'servo.attach',
    'myservo.write': 'servo.write',
    'myservo.read': 'servo.read',
    
    // Pin functions
    'pinMode': 'pinMode',
    'digitalWrite': 'digitalWrite',
    'digitalRead': 'digitalRead',
    'analogWrite': 'analogWrite',
    'analogRead': 'analogRead',
    'delay': 'delay',
    'delayMicroseconds': 'delayMicroseconds',
  };

  // Apply conversions
  Object.entries(conversions).forEach(([arduino, js]) => {
    cleaned = cleaned.replace(new RegExp(arduino, 'g'), js);
  });

  // Wrap in async function for delay support
  return `
    return (async function() {
      ${cleaned}
    })();
  `;
}