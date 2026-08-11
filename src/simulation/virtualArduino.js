// src/simulation/virtualArduino.js
import { useStore } from '../store/armStore';
import { ARM_CONFIG } from './armConfig';

export class VirtualArduino {
  constructor(logCallback) {
    const board = this; // captured so inner classes/closures reach the *board*, not their own `this`

    this.pins = new Array(20).fill(null).map(() => ({
      mode: 'INPUT',
      value: 0,
      pwm: false,
    }));
    this.servos = {};
    this.logCallback = logCallback || console.log;
    this.intervalId = null;
    this.running = true;

    // NOTE: outgoing (Serial.print/println/write) and incoming
    // (Serial.available/read, fed by receive()) are two *separate*
    // buffers. The original code used one buffer for both directions,
    // which meant a sketch's own Serial.println() output would make
    // Serial.available() true — i.e. firmware would appear to "hear"
    // its own log lines. That breaks any real request/response protocol.
    this.txBuffer = '';
    this.rxBuffer = '';

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

    // Initialize Serial (no `process` — this runs in the browser)
    this.Serial = {
      begin: (baud) => {
        board.logCallback(`Serial initialized at ${baud} baud`, 'info');
        board.txBuffer = '';
        board.rxBuffer = '';
      },
      print: (value) => {
        const str = String(value);
        board.txBuffer += str;
        board.logCallback(str, 'serial');
      },
      println: (value) => {
        const str = String(value === undefined ? '' : value);
        board.txBuffer += str + '\n';
        board.logCallback(str, 'serial');
      },
      available: () => (board.rxBuffer.length > 0 ? 1 : 0),
      read: () => {
        if (board.rxBuffer.length === 0) return -1;
        const char = board.rxBuffer.charCodeAt(0);
        board.rxBuffer = board.rxBuffer.slice(1);
        return char;
      },
      // Reads up to (and consuming) the given terminator, e.g. '\n'.
      readStringUntil: (terminator) => {
        const idx = board.rxBuffer.indexOf(terminator);
        if (idx === -1) return '';
        const s = board.rxBuffer.slice(0, idx);
        board.rxBuffer = board.rxBuffer.slice(idx + terminator.length);
        return s;
      },
      write: (data) => {
        const str = typeof data === 'number' ? String.fromCharCode(data) : String(data);
        board.txBuffer += str;
        board.logCallback(str, 'serial');
        return str.length;
      },
      flush: () => { board.txBuffer = ''; },
    };

    // Called by an external controller (e.g. the Python runtime) to
    // simulate a byte string arriving on the serial line.
    this.receive = (str) => { board.rxBuffer += String(str); };

    // Servo class — defined as a closure over `board` so its methods always
    // reach the board's pins/store/log, regardless of what `this` is inside
    // an individual Servo instance.
    this.Servo = class {
      constructor() {
        this.pin = null;
        this.angle = 90;
        this.minPulse = 544;
        this.maxPulse = 2400;
        this.isAttached = false;
      }

      attach(pin) {
        if (pin < 0 || pin >= board.pins.length) {
          board.logCallback(`Invalid servo pin ${pin}`, 'warning');
          return;
        }
        this.pin = pin;
        this.isAttached = true;
        board.pins[pin].mode = 'OUTPUT';
        board.servos[pin] = this;
        board.logCallback(`Servo attached to pin ${pin}`, 'info');
      }

      write(angle) {
        if (!this.isAttached) {
          board.logCallback('Servo not attached', 'warning');
          return;
        }
        angle = Math.max(0, Math.min(180, Math.round(Number(angle))));
        this.angle = angle;

        const joint = board.servoMap[this.pin];
        if (joint && board.store) {
          // Map the servo's 0-180 range onto this joint's configured limits
          const lim = ARM_CONFIG.limits[joint] || { min: 0, max: 180 };
          const mapped = lim.min + (angle / 180) * (lim.max - lim.min);
          board.store.setAngle(joint, mapped);

          if (joint === 'gripper') {
            const closedFraction = 1 - angle / 180; // 0 = fully open, 1 = fully closed
            if (closedFraction > 0.85 && !board._wasGripping) {
              board._wasGripping = true;
              board.logCallback('Gripper closed — object grasped (simulated contact)', 'success');
            } else if (closedFraction < 0.5) {
              board._wasGripping = false;
            }
          }
        }

        const pwmValue = Math.round((angle / 180) * 255);
        board.pins[this.pin].value = pwmValue;
      }

      read() { return this.angle; }

      writeMicroseconds(us) {
        const angle = ((us - this.minPulse) / (this.maxPulse - this.minPulse)) * 180;
        this.write(Math.round(angle));
      }

      attached() { return this.isAttached; } // no longer shadowed by a same-named field

      detach() {
        this.isAttached = false;
        delete board.servos[this.pin];
        board.logCallback(`Servo detached from pin ${this.pin}`, 'info');
      }
    };
  }

  pinMode(pin, mode) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`Invalid pin ${pin}`, 'warning');
      return;
    }
    this.pins[pin].mode = mode;
    this.logCallback(`Pin ${pin} set to ${mode}`, 'info');
  }

  digitalWrite(pin, value) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`Invalid pin ${pin}`, 'warning');
      return;
    }
    this.pins[pin].value = value ? 1 : 0;
    this.logCallback(`Digital write pin ${pin} = ${value}`, 'debug');
  }

  digitalRead(pin) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`Invalid pin ${pin}`, 'warning');
      return 0;
    }
    return this.pins[pin].value;
  }

  analogWrite(pin, value) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`Invalid pin ${pin}`, 'warning');
      return;
    }
    value = Math.max(0, Math.min(255, value));
    this.pins[pin].value = value;
    this.pins[pin].pwm = true;

    if (this.servos[pin]) {
      const angle = Math.round((value / 255) * 180);
      this.servos[pin].write(angle);
    }
    this.logCallback(`Analog write pin ${pin} = ${value}`, 'debug');
  }

  analogRead(pin) {
    if (pin < 0 || pin >= this.pins.length) {
      this.logCallback(`Invalid pin ${pin}`, 'warning');
      return 0;
    }
    const base = this.pins[pin].value || 512;
    const noise = Math.floor(Math.random() * 10 - 5);
    return Math.max(0, Math.min(1023, base + noise));
  }

  destroy() {
    this.running = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }
}