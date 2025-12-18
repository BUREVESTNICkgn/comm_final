import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';

export const LOGIN_ROUTES: Routes = [{ path: '', component: LoginComponent }];

export const REGISTER_ROUTES: Routes = [{ path: '', component: RegisterComponent }];
