// src/examples/pythonExamples.js

export const pythonExamples = {
  direct_control: `# Direct control — no firmware needed.
# arm.move() drives a joint straight away, useful for quickly
# testing poses without writing/running a C++ sketch first.

print("Running a quick demo sequence")

arm.move("base", 60)
sleep(0.5)
arm.move("shoulder", 40)
sleep(0.5)
arm.move("elbow", -50)
sleep(0.5)
arm.move("gripper", 10)
sleep(0.5)

print("Done. Try arm.home() to reset.")
arm.home()
`,

  serial_bridge: `# Python controller — the "PC" side of the link.
# Run the C++ "serial_bridge" sketch first (its tab), THEN run this.
# Every arm.send(...) call is a real command sent over the virtual
# serial line to whatever firmware is currently running.

def move(joint, angle):
    arm.send(joint + ":" + str(angle))
    sleep(0.6)

print("Starting pick-and-place routine over serial")

move("BASE", 60)
move("SHOULDER", 60)
move("ELBOW", -60)
move("GRIPPER", 10)   # close
move("ELBOW", -90)
move("BASE", 130)
move("ELBOW", -60)
move("GRIPPER", 80)   # release
move("BASE", 0)
move("SHOULDER", 0)
move("ELBOW", 0)

print("Routine complete")
`,

  sweep_loop: `# A Python-side sweep, using range() and direct control.

for angle in range(0, 150, 5):
    arm.move("base", angle)
    sleep(0.03)

for angle in range(150, 0, -5):
    arm.move("base", angle)
    sleep(0.03)

print("Sweep finished")
`,
};