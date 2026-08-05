// src/simulation/virtualArduino.js
import { useStore } from '../store/armStore';

export class VirtualArduino {
  constructor(logCallback) {
    this.pins = new Array(20).fill(null).map(() => ({
      mode: 'INPUT',
      value: 0,
      pwm: false,
    }));
    this.servos = {};
    this.logCallback = logCallback || console.log;
    this.intervalId = null;
    this.running = true;
    
    // Serial buffer
    this.serialBuffer = '';
    
    // Map servo pins to joints
    this.servoMap = {
      9: 'base',
      10: 'shoulder', 
      11: 'elbow',
      12: 'wrist',
      13: 'gripper',
    };

    // Store reference
    this.store = useStore.getState();

    // Initialize Serial
    this.Serial = {
      begin: (baud) => {
        this.logCallback(`📡 Serial initialized at ${baud} baud`, 'info');
        this.serialBuffer = '';
      },
      print: (value) => {
        const str = String(value);
        this.serialBuffer += str;
        process.stdout.write(str);
        this.logCallback(str, 'serial');
      },
      println: (value) => {
        const str = String(value) + '\n';
        this.serialBuffer += str;
        process.stdout.write(str + '\n');
        this.logCallback(str, 'serial');
      },
      available: () => {
        return this.serialBuffer.length > 0 ? 1 : 0;
      },
      read: () => {
        if (this.serialBuffer.length === 0) return -1;
        const char = this.serialBuffer.charCodeAt(0);
        this.serialBuffer = this.serialBuffer.slice(1);
        return char;
      },
      write: (data) => {
        const str = typeof data === 'number' ? String.fromCharCode(data) : String(data);
        this.serialBuffer += str;
        this.logCallback(str, 'serial');
        return str.length;
      },
      flush: () => {
        // Flush serial buffer
        this.serialBuffer = '';
      },
    };
  }

  pinMode(pin, mode) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`⚠️ Invalid pin ${pin}`, 'warning');
      return;
    }
    this.pins[pin].mode = mode;
    this.logCallback(`📌 Pin ${pin} set to ${mode}`, 'info');
  }

  digitalWrite(pin, value) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`⚠️ Invalid pin ${pin}`, 'warning');
      return;
    }
    this.pins[pin].value = value ? 1 : 0;
    this.logCallback(`⚡ Digital write pin ${pin} = ${value}`, 'debug');
  }

  digitalRead(pin) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`⚠️ Invalid pin ${pin}`, 'warning');
      return 0;
    }
    return this.pins[pin].value;
  }

  analogWrite(pin, value) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`⚠️ Invalid pin ${pin}`, 'warning');
      return;
    }
    value = Math.max(0, Math.min(255, value));
    this.pins[pin].value = value;
    this.pins[pin].pwm = true;
    
    // If pin is connected to a servo, map to angle
    if (this.servos[pin]) {
      const angle = Math.round((value / 255) * 180);
      this.servos[pin].write(angle);
    }
    
    this.logCallback(`📊 Analog write pin ${pin} = ${value}`, 'debug');
  }

  analogRead(pin) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`⚠️ Invalid pin ${pin}`, 'warning');
      return 0;
    }
    // Simulate analog read with noise
    const base = this.pins[pin].value || 512;
    const noise = Math.floor(Math.random() * 10 - 5);
    return Math.max(0, Math.min(1023, base + noise));
  }

  // Servo class
  Servo = class {
    constructor() {
      this.pin = null;
      this.angle = 90;
      this.minPulse = 544;
      this.maxPulse = 2400;
      this.attached = false;
    }

    attach(pin) {
      if (pin < 0 || pin >= this.pins.length) {
        this.logCallback(`⚠️ Invalid servo pin ${pin}`, 'warning');
        return;
      }
      this.pin = pin;
      this.attached = true;
      this.pins[pin].mode = 'OUTPUT';
      this.servos[pin] = this;
      this.logCallback(`🦾 Servo attached to pin ${pin}`, 'info');
    }

    write(angle) {
      if (!this.attached) {
        this.logCallback(`⚠️ Servo not attached`, 'warning');
        return;
      }
      // Clamp angle
      angle = Math.max(0, Math.min(180, angle));
      this.angle = angle;
      
      // Map to joint
      const joint = this.servoMap[this.pin];
      if (joint && this.store) {
        // Apply joint limits from config
        this.store.setAngle(joint, angle);
        this.logCallback(`🔄 ${joint} moved to ${angle}°`, 'debug');
      }
      
      // Update pin value
      const pwmValue = Math.round((angle / 180) * 255);
      this.pins[this.pin].value = pwmValue;
    }

    read() {
      return this.angle;
    }

    writeMicroseconds(us) {
      const angle = ((us - this.minPulse) / (this.maxPulse - this.minPulse)) * 180;
      this.write(Math.round(angle));
    }

    attached() {
      return this.attached;
    }

    detach() {
      this.attached = false;
      delete this.servos[this.pin];
      this.logCallback(`🔌 Servo detached from pin ${this.pin}`, 'info');
    }
  };

  // Delay functions (async)
  async delay(ms) {
    if (!this.running) throw new Error('Execution stopped');
    await new Promise(resolve => {
      this.intervalId = setTimeout(() => {
        if (this.running) resolve();
      }, ms);
    });
  }

  async delayMicroseconds(us) {
    if (!this.running) throw new Error('Execution stopped');
    await new Promise(resolve => {
      this.intervalId = setTimeout(() => {
        if (this.running) resolve();
      }, us / 1000);
    });
  }

  // Cleanup
  destroy() {
    this.running = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }
}