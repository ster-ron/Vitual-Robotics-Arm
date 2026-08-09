// src/simulation/virtualArduino.js
import { useStore } from '../store/armStore';
import { servoToJointAngle } from './armConfig';

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
    this.servoToJointAngle = servoToJointAngle;

    // Capture a stable reference to this board so the nested Servo class
    // (which has its own `this`) can reach back into it.
    const board = this;

    // Initialize Serial
    this.Serial = {
      begin: (baud) => {
        board.logCallback(`📡 Serial initialized at ${baud} baud`, 'info');
        board.serialBuffer = '';
      },
      print: (value) => {
        const str = String(value);
        board.serialBuffer += str;
        board.logCallback(str, 'serial');
      },
      println: (value) => {
        const str = String(value) + '\n';
        board.serialBuffer += str;
        board.logCallback(str, 'serial');
      },
      available: () => {
        return board.serialBuffer.length > 0 ? 1 : 0;
      },
      read: () => {
        if (board.serialBuffer.length === 0) return -1;
        const char = board.serialBuffer.charCodeAt(0);
        board.serialBuffer = board.serialBuffer.slice(1);
        return char;
      },
      write: (data) => {
        const str = typeof data === 'number' ? String.fromCharCode(data) : String(data);
        board.serialBuffer += str;
        board.logCallback(str, 'serial');
        return str.length;
      },
      flush: () => {
        board.serialBuffer = '';
      },
    };

    // Servo class — defined here (not as a class field) so it can close
    // over `board` and reach the real pins/store/logger instead of trying
    // (and failing) to find them on the Servo instance itself.
    this.Servo = class {
      constructor() {
        this.pin = null;
        this.angle = 90;
        this.minPulse = 544;
        this.maxPulse = 2400;
        this._attached = false;
      }

      attach(pin) {
        if (pin < 0 || pin >= board.pins.length) {
          board.logCallback(`⚠️ Invalid servo pin ${pin}`, 'warning');
          return;
        }
        this.pin = pin;
        this._attached = true;
        board.pins[pin].mode = 'OUTPUT';
        board.servos[pin] = this;
        board.logCallback(`🦾 Servo attached to pin ${pin}`, 'info');
      }

      write(angle) {
        if (!this._attached) {
          board.logCallback(`⚠️ Servo not attached`, 'warning');
          return;
        }
        // A real servo only accepts 0-180; note if the sketch asked for
        // something outside that before we clamp it.
        const requested = angle;
        angle = Math.max(0, Math.min(180, angle));
        if (requested !== angle) {
          board.logCallback(
            `⚠️ servo.write(${requested}) is outside a servo's 0-180° range - clamped to ${angle}°`,
            'warning'
          );
        }
        this.angle = angle;

        // Map the servo's physical 0-180 throw onto the joint's real range
        // of motion (e.g. shoulder -90..90), then let the store enforce
        // that range as the final authority.
        const joint = board.servoMap[this.pin];
        if (joint && board.store) {
          const logicalAngle = board.servoToJointAngle(joint, angle);
          const { clamped, wasClamped } = board.store.setAngle(joint, logicalAngle);
          if (wasClamped) {
            board.logCallback(
              `🛑 ${joint} limit reached - clamped to ${clamped}°`,
              'warning'
            );
          } else {
            board.logCallback(`🔄 ${joint} moved to ${clamped}°`, 'debug');
          }
        }

        // Update pin value
        const pwmValue = Math.round((angle / 180) * 255);
        board.pins[this.pin].value = pwmValue;
      }

      read() {
        return this.angle;
      }

      writeMicroseconds(us) {
        const angle = ((us - this.minPulse) / (this.maxPulse - this.minPulse)) * 180;
        this.write(Math.round(angle));
      }

      attached() {
        return this._attached;
      }

      detach() {
        this._attached = false;
        delete board.servos[this.pin];
        board.logCallback(`🔌 Servo detached from pin ${this.pin}`, 'info');
      }
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

  // Delay functions (async)
  async delay(ms) {
    if (!this.running) throw new Error('Execution stopped');
    await new Promise((resolve, reject) => {
      this.intervalId = setTimeout(() => {
        if (this.running) resolve();
        else reject(new Error('Execution stopped'));
      }, ms);
    });
  }

  async delayMicroseconds(us) {
    return this.delay(us / 1000);
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
