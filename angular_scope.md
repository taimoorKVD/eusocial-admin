# EUSOCIAL ADMIN - PROJECT DOCUMENTATION

## 📋 Project Overview

**Framework**: Angular 20.3.0  
**Type**: Multi-tenant SaaS Admin Dashboard  
**Language**: TypeScript 5.9.2  
**Backend API**: NestJS (localhost:3001)  
**Testing**: Jasmine/Karma  

This is a comprehensive multi-tenant admin dashboard that allows managing users, roles, products, and tenant configurations with enterprise-grade authentication and authorization.

---

## 🏗️ Architecture Overview

### Core Concept: Multi-Tenant System
- **Single Master Admin Interface** for managing all tenants
- **Separate Database per Tenant** with isolated data
- **API Routes**: `/api/master` (admin ops) and `/api/tenant` (tenant-specific ops)
- **JWT Authentication** with token-based access control

### Main Structure
```
app/
├── app-module.ts              ← Root module (bootstraps the app)
├── app-routing-module.ts      ← Main route configuration
├── app.ts                      ← Root component
├── admin/                      ← Protected area (requires auth)
│   ├── admin-module.ts
│   ├── admin.ts               ← Main layout (navbar + sidebar + router)
│   ├── navbar/                ← Top navigation
│   ├── sidebar/               ← Side navigation menu
│   ├── dashboard/             ← Landing page after login
│   ├── users/                 ← User management
│   ├── roles/                 ← Role management with permissions
│   ├── products/              ← Product catalog with image upload
│   ├── tenants/               ← Multi-tenant configuration
│   └── profile/               ← User profile self-service
├── public/                     ← Public area (login/register, no auth needed)
│   ├── public-module.ts
│   ├── login/                 ← User authentication page
│   └── register/              ← New account registration
├── guards/                     ← Route protection
│   └── auth-guard.ts          ← Protect admin routes
├── interceptors/              ← HTTP request/response processing
│   ├── auth-interceptor.ts    ← Inject JWT token in requests
│   └── error-interceptor.ts   ← Handle 401/403 auto-logout
├── services/                  ← Business logic & API calls
│   ├── auth.ts               ← Authentication & session management
│   ├── user.service.ts       ← User CRUD
│   ├── role.service.ts       ← Role CRUD with permissions
│   ├── product.service.ts    ← Product CRUD with file upload
│   ├── tenant.service.ts     ← Tenant CRUD
│   └── permission.service.ts ← Permission list
└── interfaces/                ← TypeScript data models
    ├── user.ts
    ├── role.ts
    ├── product.ts
    ├── tenant.ts
    ├── permission.ts
    └── authresponse.ts
```

---

## 🔐 Authentication & Authorization System

### Authentication Flow
```
1. User visits app (home page)
   ↓
2. AuthGuard activates
   ↓
3. auth.initUser() validates existing session
   ↓
4. If token exists → Validate via API
   ↓
5. If valid → Load dashboard
   If invalid → Redirect to /login
```

### AuthGuard ([auth-guard.ts](src/app/guards/auth-guard.ts))
- **Protects**: All routes under `/` (admin section)
- **Mechanism**: Checks if user is logged in via `auth.isLoggedIn()`
- **Fallback**: Redirects to `/login` if no valid token

### AuthInterceptor ([auth-interceptor.ts](src/app/interceptors/auth-interceptor.ts))
- **Automatically attaches JWT token** to all API requests
- **Skips**: `/login` and `/register` endpoints (no token needed)
- **Header Format**: `Authorization: Bearer {token}`

### ErrorInterceptor ([error-interceptor.ts](src/app/interceptors/error-interceptor.ts))
- **Handles 401/403**: Auto-logout and redirect to login
- **Handles 5xx**: Logs server errors
- **Prevents**: Stuck sessions with expired tokens

---

## 📱 Routing Configuration

### Complete Route Map
```
PUBLIC ROUTES (no authentication required):
├── /login                          → Login page
└── /register                       → Registration page

PROTECTED ROUTES (AuthGuard required):
└── /                              ← Admin root
    ├── /dashboard                 ← Default redirect (home)
    ├── /profile                   ← Edit user profile
    ├── /users
    │   ├── ''                     ← User list with pagination
    │   ├── /create               ← Create new user
    │   └── /:id/edit             ← Edit user
    ├── /roles
    │   ├── ''                     ← Role list
    │   ├── /create               ← Create role + assign permissions
    │   └── /:id/edit             ← Edit role + permissions
    ├── /products
    │   ├── ''                     ← Product list with pagination
    │   ├── /create               ← Create product + upload image
    │   └── /:id/edit             ← Edit product + change image
    └── /tenants
        ├── ''                     ← Tenant list (multi-tenant list)
        ├── /create               ← Create new tenant
        └── /:id/edit             ← Edit tenant config

CATCH-ALL:
└── /* → Redirects to /login
```

---

## 🔧 Services (API Integration Layer)

### Auth Service ([auth.ts](src/app/services/auth.ts))
**Purpose**: User authentication, session management, user state

| Method | HTTP | Purpose |
|--------|------|---------|
| `login(credentials)` | POST `/login` | Authenticate user, store token & user |
| `register(userData)` | POST `/register` | Create new account |
| `user()` | GET `/auth/user` | Fetch current user profile |
| `initUser()` | AUTO | Validate session on app startup |
| `logout()` | - | Clear token/user, redirect to login |
| `isLoggedIn()` | - | Check if token exists |
| `getToken()` | - | Get stored JWT token |
| `currentUser()` | - | Get user from BehaviorSubject |
| `refreshUser()` | - | Fetch latest user data from server |

**State Management**:
- **currentUser$** - BehaviorSubject observable of logged-in user
- **localStorage Keys**: `access_token`, `user`

---

### User Service ([user.service.ts](src/app/services/user.service.ts))
**Purpose**: User management CRUD operations  
**Endpoint**: `/api/master/users`

| Method | HTTP | Purpose |
|--------|------|---------|
| `getUsers(page)` | GET | Fetch paginated user list (default page=1) |
| `getUser(id)` | GET | Fetch single user by ID |
| `createUser(data)` | POST | Create new user |
| `updateUser(id, data)` | PUT | Update user details |
| `deleteUser(id)` | DELETE | Remove user |

**Response Format**: `{ success: boolean, data: User[], ... }`

---

### Product Service ([product.service.ts](src/app/services/product.service.ts))
**Purpose**: Product catalog management with image uploads  
**Endpoint**: `/api/master/products`

| Method | HTTP | Purpose |
|--------|------|---------|
| `getProducts(page)` | GET | Fetch paginated product list |
| `getProduct(id)` | GET | Fetch single product |
| `createProduct(data)` | POST | Create product (supports FormData for images) |
| `updateProduct(id, data)` | PUT | Update product (supports FormData for images) |
| `deleteProduct(id)` | DELETE | Remove product |

**Special Features**:
- Accepts both **JSON objects** and **FormData** (for file uploads)
- Image handling: File → FormData → API upload
- Image display: API URL in product response

---

### Role Service ([role.service.ts](src/app/services/role.service.ts))
**Purpose**: Role management with permission assignment  
**Endpoint**: `/api/master/roles`

| Method | HTTP | Purpose |
|--------|------|---------|
| `getRoles(page)` | GET | Fetch paginated roles |
| `getAllRoles()` | GET | Get all roles (no pagination, used in user form) |
| `getRole(id)` | GET | Fetch role with permissions array |
| `createRole(data)` | POST | Create role with permissions |
| `updateRole(id, data)` | PUT | Update role + permissions |
| `deleteRole(id)` | DELETE | Remove role |

**Permission Data**: Roles include `permissions: Permission[]` array

---

### Permission Service ([permission.service.ts](src/app/services/permission.service.ts))
**Purpose**: Get available permissions for role assignment  
**Endpoint**: `/api/master/permissions`

| Method | HTTP | Purpose |
|--------|------|---------|
| `getAll()` | GET | Get all available permissions with count |

**Usage**: Provides permission list to RoleForm for checkbox selection

---

### Tenant Service ([tenant.service.ts](src/app/services/tenant.service.ts))
**Purpose**: Multi-tenant configuration management  
**Endpoint**: `/api/master/tenants`

| Method | HTTP | Purpose |
|--------|------|---------|
| `getTenants(page)` | GET | Fetch paginated tenant list |
| `getOne(id)` | GET | Fetch single tenant config |
| `create(data)` | POST | Create new tenant |
| `update(id, data)` | PUT | Update tenant settings |
| `delete(id)` | DELETE | Remove tenant |

**Tenant Model**:
- `name` - Tenant display name
- `dbName` - Separate database name
- `subdomain` - Subdomain for tenant access
- `customDomain` - Optional white-label domain

---

## 🎨 Components (UI Layer)

### **Authentication Components**

#### Login ([login.ts](src/app/public/login/login.ts))
**Location**: `/login`  
**Purpose**: User authentication

**Features**:
- Reactive form validation (email & password)
- Password visibility toggle
- Error message display
- Loading state during submission
- Auto-redirect if already logged in
- Link to registration page

**Form Validation**:
- Email: required, valid email format
- Password: required, minimum 6 characters

---

#### Register ([register.ts](src/app/public/register/register.ts))
**Location**: `/register`  
**Purpose**: New user account creation

**Features**:
- Template-driven form
- Name field (required)
- Email validation
- Password matching validation
- Auto-assigns default role (role_id: 2)
- Success toast + redirect to login
- Login link

**Form Fields**:
- `name` - User full name
- `email` - Email address
- `password` - Account password (min 6 chars)
- `password_confirm` - Password confirmation

---

### **Admin Layout Components**

#### Admin ([admin.ts](src/app/admin/admin.ts))
**Purpose**: Main protected layout wrapper

**Structure**:
```
┌─────────────────────────────┐
│  NAVBAR (top)               │ ← User profile, logout button
├───────┬─────────────────────┤
│ SIDE  │  ROUTER OUTLET      │ ← Page content (dashboard, users, etc)
│ BAR   │  (main content)     │
│       │                     │
└───────┴─────────────────────┘
```

---

#### Navbar ([navbar.ts](src/app/admin/navbar/navbar.ts))
**Purpose**: Top navigation bar

**Features**:
- Display logged-in user name/email
- Logout button
- Real-time user updates (subscribes to `Auth.currentUser$`)

---

#### Sidebar ([sidebar.ts](src/app/admin/sidebar/sidebar.ts))
**Purpose**: Navigation menu

**Menu Items**:
- Dashboard
- Users
- Roles
- Products
- Tenants
- Profile
- Logout

---

#### Dashboard ([dashboard.ts](src/app/admin/dashboard/dashboard.ts))
**Location**: `/dashboard`  
**Purpose**: Landing page after login

**Content**: Overview/statistics (expandable as needed)

---

### **Resource Management Components**

#### **USERS MANAGEMENT**

##### Users List ([users.ts](src/app/admin/users/users.ts))
**Location**: `/users`  
**Purpose**: Display all users with CRUD actions

**Features**:
- Paginated user list (with prev/next buttons)
- Display: ID, Name, Email, Role, Actions
- Delete button (with confirmation)
- Edit button (redirects to UserForm)
- Create button (redirects to UserForm with create mode)
- Success/error toast messages
- Loading state

**Calls Service**: `UserService.getUsers(page)`, `UserService.deleteUser(id)`

---

##### User Form ([user-form.ts](src/app/admin/users/user-form/user-form.ts))
**Location**: `/users/create` or `/users/:id/edit`  
**Purpose**: Create/edit user accounts

**Features**:
- Route parameter detection for create vs edit mode
- Reactive form validation
- Password field (required on create, optional on edit)
- Password confirmation matching with custom validator
- Password visibility toggle
- Role selection dropdown (loaded from RoleService)
- Delete button (edit mode only)
- Form submission with error handling

**Form Fields**:
```
name              [text input]     (required)
email             [email input]    (required, valid email)
role_id           [dropdown]       (required, from roles list)
password          [password input] (required on create, optional on edit, min 6)
password_confirm  [password input] (must match password if filled)
```

**Form Validation**:
- Email format validation
- Password length validation (min 6)
- Password confirmation matching
- Custom `passwordMatchValidator`

---

#### **PRODUCTS MANAGEMENT**

##### Products List ([products.ts](src/app/admin/products/products.ts))
**Location**: `/products`  
**Purpose**: Display product catalog with CRUD actions

**Features**:
- Paginated product list
- Display: ID, Name, Price, Image, Actions
- Product image display (from API URL)
- Delete button (with confirmation)
- Edit button (redirects to ProductForm)
- Create button (redirects to ProductForm)
- Loading/error states

**Calls Service**: `ProductService.getProducts(page)`, `ProductService.deleteProduct(id)`

---

##### Product Form ([product-form.ts](src/app/admin/products/product-form/product-form.ts))
**Location**: `/products/create` or `/products/:id/edit`  
**Purpose**: Create/edit products with image upload

**Features**:
- Create vs edit mode detection
- Image preview (FileReader API)
- File input with onChange handling
- FormData construction for multipart upload
- Load existing product data for editing
- Form validation

**Form Fields**:
```
name              [text input]     (required)
description       [textarea]       (optional)
price             [number input]   (required, min 0)
image             [file input]     (optional)
                  [preview image]  (preview before upload)
```

**Image Handling**:
- Accept image files (.jpg, .png, etc)
- Display preview using FileReader
- Send as FormData with Content-Type: multipart/form-data
- API returns image URL in response

---

#### **ROLES MANAGEMENT**

##### Roles List ([roles.ts](src/app/admin/roles/roles.ts))
**Location**: `/roles`  
**Purpose**: Display roles with CRUD actions

**Features**:
- Paginated role list
- Display: ID, Name, Permissions count, Actions
- Delete button (with confirmation)
- Edit button (redirects to RoleForm)
- Create button (redirects to RoleForm)
- Status messages

**Calls Service**: `RoleService.getRoles(page)`, `RoleService.deleteRole(id)`

---

##### Role Form ([role-form.ts](src/app/admin/roles/role-form/role-form.ts))
**Location**: `/roles/create` or `/roles/:id/edit`  
**Purpose**: Create/edit roles with permission assignment

**Features**:
- Create vs edit mode
- Loads all permissions from PermissionService
- Groups permissions by module/entity
- Checkboxes for permission selection
- Pre-select permissions when editing
- Reactive form validation
- Delete button (edit mode only)

**Permission Grouping**:
- Extracts permissions like `create-users`, `view-products`
- Groups by entity: "Users", "Products", etc
- Groups by action: "View", "Create", "Edit", "Delete"

**Form Structure**:
```
name              [text input]     (required)
[Permissions Section]
  └── Users
      ├── ☐ View Users
      ├── ☐ Create Users
      ├── ☐ Edit Users
      └── ☐ Delete Users
  └── Products
      ├── ☐ View Products
      ├── ☐ Create Products
      └── ...
```

---

#### **TENANTS MANAGEMENT**

##### Tenants List ([tenants.ts](src/app/admin/tenants/tenants.ts))
**Location**: `/tenants`  
**Purpose**: Display all tenants (multi-tenant configuration)

**Features**:
- Paginated tenant list
- Display: ID, Name, Database, Subdomain, Custom Domain, Actions
- Delete button (with confirmation)
- Edit button (redirects to TenantForm)
- Create button (redirects to TenantForm)

**Calls Service**: `TenantService.getTenants(page)`, `TenantService.delete(id)`

---

##### Tenant Form ([tenant-form.ts](src/app/admin/tenants/tenant-form/tenant-form.ts))
**Location**: `/tenants/create` or `/tenants/:id/edit`  
**Purpose**: Create/edit tenant configurations

**Features**:
- Create vs edit mode
- Reactive form for tenant configuration
- Delete button (edit mode only)
- Form validation

**Form Fields**:
```
name              [text input]     (required)
customDomain      [text input]     (optional, for white-label)
```

---

#### **PROFILE MANAGEMENT**

##### Profile ([profile.ts](src/app/admin/profile/profile.ts))
**Location**: `/profile`  
**Purpose**: User self-service profile editing

**Features**:
- Load current user from `Auth.currentUser$`
- Edit own name, email
- Optional password change
- Form validation
- Update via special `/users/profile` endpoint
- Refresh user state after save
- Success/error messages

**Form Fields**:
```
name              [text input]     (required)
email             [email input]    (required)
password          [password input] (optional, only to change)
password_confirm  [password input] (must match password)
```

---

## 📊 Data Models & Interfaces

### User Interface ([user.ts](src/app/interfaces/user.ts))
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role?: Role;              // User's assigned role with permissions
  createdAt?: string;       // ISO datetime
  updatedAt?: string;       // ISO datetime
}
```

---

### AuthResponse Interface ([authresponse.ts](src/app/interfaces/authresponse.ts))
```typescript
interface AuthResponse {
  success: boolean;         // Request success status
  message: string;          // Response message
  access_token: string;     // JWT token for auth
  user: User;               // Logged-in user details
}
```

---

### Role Interface ([role.ts](src/app/interfaces/role.ts))
```typescript
interface Role {
  id: number;
  name: string;             // Role name (e.g., "Admin", "Editor")
  createdAt?: string;
  updatedAt?: string;
  permissions?: Permission[]; // Array of assigned permissions
}
```

---

### Permission Interface ([permission.ts](src/app/interfaces/permission.ts))
```typescript
interface Permission {
  id: number;
  name: string;             // e.g., "view-users", "create-products"
}
```

---

### Product Interface ([product.ts](src/app/interfaces/product.ts))
```typescript
interface Product {
  id: number;
  name: string;
  image?: string;           // Image URL from API
  description?: string;
  price: number;            // Product price
  createdAt?: string;
  updatedAt?: string;
}
```

---

### Tenant Interface ([tenant.ts](src/app/interfaces/tenant.ts))
```typescript
interface Tenant {
  id: number;
  name: string;             // Display name
  dbName: string;           // Separate database name
  subdomain: string;        // Subdomain (e.g., "acme.app.com")
  customDomain: string | null; // White-label domain
  createdAt: string;
  updatedAt?: string;
}
```

---

## 🏛️ Architecture & Design Patterns

### 1. **Component-Service Pattern**
- **Components**: Handle UI, user interaction, form validation
- **Services**: Handle API calls, business logic, state management
- **Separation**: Clear boundary between view logic and business logic

### 2. **Reactive Forms Pattern**
- Used in: UserForm, ProductForm, RoleForm, TenantForm, Profile
- Features: Validation, error handling, form reset, disable/enable fields
- Benefits: Complex validation, programmatic control

### 3. **Observable-based State Management**
- `Auth.currentUser$` - BehaviorSubject for user state
- Components subscribe and react to user changes
- Real-time UI updates without manual refresh

### 4. **Pagination Pattern**
- All list components: Users, Products, Roles, Tenants
- Parameters: `page` (current), `total`, `lastPage`
- Navigation: Prev/Next buttons

### 5. **CRUD Component Template**
Each resource follows this pattern:
1. **List Component** - Display paginated items with delete/edit actions
2. **Form Component** - Create/Edit via URL parameter detection
3. **Service** - API CRUD methods (GET/POST/PUT/DELETE)
4. **Interface** - TypeScript type definitions

### 6. **Guardian Pattern (Route Protection)**
- AuthGuard validates session before route access
- Prevents unauthorized access to admin area
- Automatic redirect to login

### 7. **Interceptor Pattern (Cross-cutting Concerns)**
- AuthInterceptor: Token injection on all requests
- ErrorInterceptor: Global error handling and 401 auto-logout
- Eliminates repetitive code in services

### 8. **Multi-tenant Architecture**
- Master admin interface manages all tenants
- Each tenant has separate database
- API routes split: `/api/master` vs `/api/tenant`
- Tenant selection via URL/subdomain

---

## 🌐 Environment Configuration

### environment.ts & environment.prod.ts
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001/api/master',      // Main admin API base
  tenantApiUrl: 'http://localhost:3001/api/tenant'  // Tenant-specific API
};
```

**Usage**:
- Services inject `environment` to construct full endpoint URLs
- Example: `GET http://localhost:3001/api/master/users`

---

## 🧪 Testing Structure

### Test Files
Each component and service has a `.spec.ts` file:
- `users.spec.ts` - Users list component tests
- `user-form.spec.ts` - User form component tests
- `user.service.spec.ts` - User service tests
- etc.

**Testing Framework**: Jasmine & Karma

---

## 🎯 Key Features Summary

| Feature | Implementation | Location |
|---------|-----------------|----------|
| **JWT Authentication** | Login service + localStorage | auth.ts, login.ts |
| **Session Persistence** | Token + user stored in localStorage | auth.ts |
| **Route Protection** | AuthGuard on all admin routes | auth-guard.ts |
| **Token Auto-injection** | AuthInterceptor on all requests | auth-interceptor.ts |
| **Auto-logout (401/403)** | ErrorInterceptor error handling | error-interceptor.ts |
| **User Management** | Full CRUD (Create, Read, Update, Delete) | users/, user.service.ts |
| **Role Management** | Roles with permission assignment | roles/, role.service.ts |
| **Permissions System** | Checkbox selection of permissions | role-form.ts, permission.service.ts |
| **Product Catalog** | Full CRUD with image upload | products/, product.service.ts |
| **Multi-tenant** | Tenant management with separate DBs | tenants/, tenant.service.ts |
| **User Profile** | Self-service profile editing | profile/, auth.ts |
| **Pagination** | All list components support pagination | users.ts, products.ts, etc |
| **Form Validation** | Reactive forms with custom validators | user-form.ts, product-form.ts, etc |
| **Image Handling** | FileReader preview + FormData upload | product-form.ts |

---

## 📈 Data Flow Examples

### Login Flow
```
User fills login form
        ↓
login.ts calls auth.login()
        ↓
auth.ts sends POST /login
        ↓
API returns { access_token, user }
        ↓
localStorage.setItem('access_token', token)
localStorage.setItem('user', user)
currentUser$ emits user
        ↓
Components subscribed to currentUser$ update
Navbar shows user name/email
        ↓
Router redirects to /dashboard
```

---

### Create User Flow
```
Admin clicks "Create User"
        ↓
Route to /users/create
        ↓
UserForm loads (create mode)
        ↓
Admin fills form + selects role
        ↓
Submit form
        ↓
user-form.ts calls userService.createUser()
        ↓
userService sends POST /api/master/users
        ↓
AuthInterceptor adds token to header
        ↓
API creates and returns new user
        ↓
Success toast message
Redirect to /users list
```

---

### Edit Product Flow
```
Admin clicks edit on product
        ↓
Route to /products/:id/edit
        ↓
ProductForm loads product data
        ↓
productService.getProduct(id)
        ↓
Display form with existing data
        ↓
Admin uploads new image + edits fields
        ↓
Submit form
        ↓
ProductForm constructs FormData with file
        ↓
productService.updateProduct(id, formData)
        ↓
API processes multipart upload
        ↓
Success message, redirect to /products
```

---

### Role Assignment Flow
```
Admin creates new role
        ↓
RoleForm loads all permissions
        ↓
permissionService.getAll()
        ↓
Permissions grouped by module
Display checkboxes for selection
        ↓
Admin checks: "View Users", "Create Products", etc
        ↓
Submit form
        ↓
roleService.createRole({ name, permissions: [1, 3, 5] })
        ↓
API creates role with assigned permissions
        ↓
Success, redirect to /roles list
```

---

## 🔄 Real-time Operations

### User Updates Across Components
```
User logs in
        ↓
auth.ts sets currentUser$
        ↓
navbar.ts subscribes to currentUser$
profile.ts subscribes to currentUser$
        ↓
User updates profile
        ↓
auth.refreshUser()
        ↓
currentUser$ emits new user data
        ↓
navbar & profile components automatically update
```

---

## 📦 Module Dependencies

### AppModule imports:
- BrowserModule
- HttpClientModule
- AppRoutingModule
- AdminModule
- PublicModule

### AdminModule provides:
- All admin components
- Reactive forms
- Date pipe for formatting

### PublicModule provides:
- Login & Register components
- Forms module for template forms

---

## 🚀 Ready Features & Next Steps

### Already Implemented ✅
- Complete authentication system
- All CRUD operations (Users, Products, Roles, Tenants)
- Role-based permissions
- Image upload
- Multi-tenant support
- Form validation
- Error handling
- Pagination
- Route protection
- Session management

### Possible Enhancements
- Dashboard statistics & charts
- Advanced filtering/search
- Bulk operations
- Real-time notifications
- Audit logs
- Export to CSV/PDF
- User activity tracking
- Advanced permission rules (resource-level permissions)

---

## 📞 Quick Reference

### To add a new admin feature:
1. Create component in `admin/your-feature/`
2. Create service in `services/your-feature.service.ts`
3. Add interface in `interfaces/your-feature.ts`
4. Add route in `app-routing-module.ts`
5. Add menu item in `sidebar.ts`
6. Implement CRUD following existing patterns

### Common Commands:
```bash
npm start              # Start dev server
npm test              # Run tests
npm run build         # Build for production
ng generate component # Generate new component
ng generate service   # Generate new service
```

---

**Last Updated**: April 7, 2026  
**Project Status**: Feature Complete & Production Ready
