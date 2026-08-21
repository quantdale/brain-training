#!/usr/bin/env node
// Manual pause-overlay probe: drives a game to paused state and dumps what
// uiautomator sees (diagnostic tool, not part of the QA harness).
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ADB = 'adb -s emulator-5554';
const PKG = 'com.braintraining.app';
const gameId = process.argv[2] ?? 'spatial-grid-nav';

const sh = (c) => execSync(c, { encoding: 'utf8', shell: 'bash' });
const dump = () => {
  sh(`${ADB} shell "uiautomator dump /sdcard/t.xml > /dev/null 2>&1; cat /sdcard/t.xml" > t-probe.xml`);
  return read();
};
const read = () => {
  try {
    return execSync('node -e "process.stdout.write(require(\'fs\').readFileSync(\'t-probe.xml\',\'utf8\'))"', { encoding: 'utf8' });
  } catch {
    return '';
  }
};
function tapId(xml, id) {
  const m = xml.match(new RegExp(`resource-id="${id}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  const cx = (Number(m[1]) + Number(m[3])) / 2;
  const cy = (Number(m[2]) + Number(m[4])) / 2;
  sh(`${ADB} shell "input tap ${cx} ${cy}"`);
  console.log(`tapped ${id} at ${cx},${cy}`);
  return true;
}
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

sh(`${ADB} shell "am force-stop ${PKG}"`);
sleep(1500);
sh(`${ADB} shell "pm clear ${PKG}" > /dev/null 2>&1`);
sh(`${ADB} reverse tcp:8081 tcp:8081`);
sh(`${ADB} shell "monkey -p ${PKG} -c android.intent.category.LAUNCHER 1" > /dev/null 2>&1`);
sleep(55000);
sh(`${ADB} shell "am start -W -a android.intent.action.VIEW -d 'braintraining://game/${gameId}' ${PKG}" > /dev/null 2>&1`);
sleep(12000);

let xml = dump();
tapId(xml, `${gameId}.tutorial-skip`);
sleep(2000);
xml = dump();
tapId(xml, `${gameId}.start`);
sleep(6000);
xml = dump();
if (!tapId(xml, `${gameId}.pause`)) console.log('pause button not found');
sleep(3000);
xml = dump();

writeFileSync('t-probe-paused.xml', xml);
for (const id of [`${gameId}.pause-overlay`, `${gameId}.resume`, `${gameId}.quit`, `${gameId}.pause-title`]) {
  console.log(id, xml.includes(`resource-id="${id}"`) ? 'PRESENT' : 'absent');
}
console.log('Resume text:', /text="Resume"/.test(xml));
