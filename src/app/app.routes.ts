import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/level-select/level-select.component').then(
        (m) => m.LevelSelectComponent
      ),
  },
  {
    path: 'play/:level',
    loadComponent: () =>
      import('./features/melody-memory/melody-memory.component').then(
        (m) => m.MelodyMemoryComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
