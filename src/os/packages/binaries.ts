/**
 * Binary names installed under /usr/bin for each package — shared between the initial
 * filesystem seed (phase 3) and the live `apt install`/`apt remove` commands (phase 4.8),
 * so the two never drift out of sync with each other.
 */
export const PACKAGE_BINARIES: Record<string, string[]> = {
  bash: ['bash', 'sh'],
  coreutils: ['ls', 'cat', 'cp', 'mv', 'rm', 'mkdir'],
  apt: ['apt', 'apt-get'],
  dpkg: ['dpkg'],
  systemd: ['systemctl', 'systemd'],
  'openssh-server': ['sshd', 'ssh'],
  git: ['git'],
  curl: ['curl'],
  wget: ['wget'],
  htop: ['htop'],
  tree: ['tree'],
  neofetch: ['neofetch'],
  python3: ['python3'],
  nodejs: ['node'],
  'docker.io': ['docker'],
  nginx: ['nginx'],
  vim: ['vim'],
}

export function binariesFor(pkgName: string): string[] {
  return PACKAGE_BINARIES[pkgName] ?? [pkgName]
}
