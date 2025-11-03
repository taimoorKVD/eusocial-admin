import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

platformBrowser().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
})
//  .then((appRef) => {
//     // ✅ After app module bootstraps, get Auth service instance
//     const injector = appRef.injector;
//     const auth = injector.get(Auth);

//     // ✅ Wait for user session initialization before allowing routing
//     return auth.initUser();
//   })
  .catch(err => console.error(err));
