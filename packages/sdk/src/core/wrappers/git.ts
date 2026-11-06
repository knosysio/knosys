import { execSync } from 'child_process';

/**
 * Add git submodule
 */
export function addModule(moduleName: string, moduleOrigin: string, modulePath: string): void {
  execSync(`git submodule add --name ${moduleName} ${moduleOrigin} ${modulePath}`, { stdio: 'inherit' });
}

/**
 * Update git submodule
 */
export function updateModule(gitModulePath: string): void {
  execSync(`git submodule update --remote ${gitModulePath}`, { stdio: 'inherit' });
}
