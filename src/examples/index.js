// src/examples/index.js
export const examples = {
  basic_sweep: `
#include <Servo.h>

Servo base;
Servo shoulder;
Servo elbow;
Servo gripper;

void setup() {
  Serial.begin(9600);
  base.attach(9);
  shoulder.attach(10);
  elbow.attach(11);
  gripper.attach(13);
  
  Serial.println("🤖 Basic Sweep Example");
  Serial.println("Sweeping from 0 to 180 degrees");
}

void loop() {
  // Sweep base from 0 to 180
  for(int angle = 0; angle <= 180; angle += 2) {
    base.write(angle);
    shoulder.write(angle / 2);
    elbow.write(180 - angle);
    delay(15);
  }
  
  // Sweep back
  for(int angle = 180; angle >= 0; angle -= 2) {
    base.write(angle);
    shoulder.write(angle / 2);
    elbow.write(180 - angle);
    delay(15);
  }
  
  Serial.println("✨ Cycle complete");
}
`,

  pick_place: `
#include <Servo.h>

Servo base;
Servo shoulder;
Servo elbow;
Servo wrist;
Servo gripper;

void setup() {
  Serial.begin(9600);
  base.attach(9);
  shoulder.attach(10);
  elbow.attach(11);
  wrist.attach(12);
  gripper.attach(13);
  
  Serial.println("📦 Pick and Place Demo");
  Serial.println("Position: Base=0, Shoulder=45, Elbow=-90");
  
  // Home position
  goHome();
}

void loop() {
  // Pick up
  Serial.println("⬇️ Moving to pick position");
  moveTo(0, 45, -60, 0);
  delay(500);
  
  Serial.println("✊ Closing gripper");
  gripper.write(0);
  delay(500);
  
  Serial.println("⬆️ Lifting up");
  moveTo(0, 60, -90, 0);
  delay(500);
  
  Serial.println("➡️ Rotating to place position");
  moveTo(90, 60, -90, 0);
  delay(500);
  
  Serial.println("⬇️ Lowering to place");
  moveTo(90, 45, -60, 0);
  delay(500);
  
  Serial.println("✋ Opening gripper");
  gripper.write(90);
  delay(500);
  
  Serial.println("⬆️ Return home");
  moveTo(90, 60, -90, 0);
  delay(500);
  goHome();
  delay(1000);
}

void moveTo(int b, int s, int e, int w) {
  base.write(b);
  shoulder.write(s);
  elbow.write(e);
  wrist.write(w);
  delay(300);
}

void goHome() {
  moveTo(0, 30, -45, 0);
  gripper.write(45);
}
`,

  wave_pattern: `
#include <Servo.h>

Servo base;
Servo shoulder;
Servo elbow;
Servo gripper;

void setup() {
  Serial.begin(9600);
  base.attach(9);
  shoulder.attach(10);
  elbow.attach(11);
  gripper.attach(13);
  
  Serial.println("👋 Wave Pattern Demo");
}

void loop() {
  // Wave pattern
  for(int i = 0; i < 3; i++) {
    // Wave right
    for(int angle = 0; angle <= 90; angle += 3) {
      base.write(angle);
      shoulder.write(30 + (angle / 3));
      elbow.write(-60 + (angle / 3));
      delay(10);
    }
    
    // Wave left
    for(int angle = 90; angle >= 0; angle -= 3) {
      base.write(angle);
      shoulder.write(30 + (angle / 3));
      elbow.write(-60 + (angle / 3));
      delay(10);
    }
  }
  
  // Return home
  for(int angle = 0; angle <= 30; angle += 2) {
    base.write(0);
    shoulder.write(angle);
    elbow.write(-angle * 1.5);
    delay(10);
  }
  
  Serial.println("👋 Wave complete!");
  delay(1000);
}
`
};