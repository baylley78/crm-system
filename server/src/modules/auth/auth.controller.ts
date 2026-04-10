import { Body, Controller, Delete, Get, Param, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from './auth.service'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { CreateUserDto } from './dto/create-user.dto'
import { RegisterUserDto } from './dto/register-user.dto'
import { CreateRoleDto } from './dto/create-role.dto'
import { CopyRoleDto } from './dto/copy-role.dto'
import { UpdateRoleMetaDto } from './dto/update-role-meta.dto'
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto'
import { UpdateRoleUsersDto } from './dto/update-role-users.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { BatchUpdateUserStatusDto } from './dto/batch-update-user-status.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ login: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.login(dto)
    if (!user) {
      throw new UnauthorizedException('账号或密码错误')
    }
    return user
  }

  @Post('register')
  register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.view')
  @Get('roles')
  findRoles(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.findRoles(currentUser)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.create')
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.authService.createRole(dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.edit')
  @Patch('roles/:id/meta')
  updateRoleMeta(@Param('id') id: string, @Body() dto: UpdateRoleMetaDto) {
    return this.authService.updateRoleMeta(Number(id), dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.create')
  @Post('roles/:id/copy')
  copyRole(@Param('id') id: string, @Body() dto: CopyRoleDto) {
    return this.authService.copyRole(Number(id), dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.delete')
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.authService.deleteRole(Number(id))
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.edit')
  @Post('roles/sync-built-in')
  syncBuiltInRolePermissions() {
    return this.authService.syncBuiltInRolePermissions()
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.view')
  @Get('permissions')
  findPermissions() {
    return this.authService.findPermissions()
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.users.view')
  @Get('users')
  findUsers(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.findUsers(currentUser)
  }

  @UseGuards(CurrentUserGuard)
  @Get('me')
  getMe(@CurrentUser() currentUser: AuthenticatedUser) {
    return currentUser
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.users.create')
  @Post('users')
  createUser(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.authService.createUser(currentUser, dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.users.status')
  @Patch('users/status/batch')
  updateUsersStatusBatch(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: BatchUpdateUserStatusDto) {
    return this.authService.updateUsersStatusBatch(currentUser, dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.users.edit')
  @Patch('users/:id')
  updateUser(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(currentUser, Number(id), dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.users.delete')
  @Delete('users/:id')
  deleteUser(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.authService.deleteUser(currentUser, Number(id))
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.assign')
  @Get('roles/:id/users')
  findRoleUsers(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.authService.findRoleUsers(currentUser, Number(id))
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.assign')
  @Patch('roles/:id/users')
  updateRoleUsers(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoleUsersDto) {
    return this.authService.updateRoleUsers(currentUser, Number(id), dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.roles.edit')
  @Patch('roles/:id/permissions')
  updateRolePermissions(@Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.authService.updateRolePermissions(Number(id), dto)
  }
}
