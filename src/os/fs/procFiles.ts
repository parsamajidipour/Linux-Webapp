export const PROC_VERSION =
  'Linux version 6.11.0-generic (buildd@lcy02-amd64-054) (x86_64-linux-gnu-gcc-13) #24-Ubuntu SMP PREEMPT_DYNAMIC\n'

export const PROC_CPUINFO = Array.from({ length: 4 }, (_, i) =>
  [
    `processor\t: ${i}`,
    'vendor_id\t: GenuineIntel',
    'model name\t: Web V8 JIT (virtual)',
    'cpu MHz\t\t: 3400.000',
    'cache size\t: 8192 KB',
    'cpu cores\t: 4',
  ].join('\n'),
).join('\n\n') + '\n'

export const PROC_MOUNTS = [
  '/dev/sda1 / ext4 rw,relatime 0 0',
  'proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0',
  'sysfs /sys sysfs rw,nosuid,nodev,noexec,relatime 0 0',
  'tmpfs /tmp tmpfs rw,nosuid,nodev 0 0',
  'tmpfs /run tmpfs rw,nosuid,nodev,mode=755 0 0',
].join('\n') + '\n'

/** `/proc/uptime`: "<uptime seconds> <idle seconds>" — real format, recomputed on every read. */
export function renderProcUptime(uptimeSeconds: number): string {
  const idle = uptimeSeconds * 3.7 // rough multi-core idle-time approximation, like a real /proc/uptime
  return `${uptimeSeconds.toFixed(2)} ${idle.toFixed(2)}\n`
}

/** `/proc/meminfo`: fake but plausible, with a little jitter so repeated reads aren't byte-identical. */
export function renderProcMeminfo(): string {
  const totalKb = 8_124_000
  const usedKb = 1_800_000 + Math.round(Math.random() * 400_000)
  const freeKb = totalKb - usedKb
  return [
    `MemTotal:       ${totalKb} kB`,
    `MemFree:        ${freeKb} kB`,
    `MemAvailable:   ${freeKb + 500_000} kB`,
    `SwapTotal:      2097148 kB`,
    `SwapFree:       2097148 kB`,
  ].join('\n') + '\n'
}
