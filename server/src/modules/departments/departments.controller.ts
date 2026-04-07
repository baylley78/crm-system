import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { DepartmentsService } from './departments.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.departments.view')
  @Get('tree')
  findTree(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.departmentsService.findTree(currentUser)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.departments.create')
  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.departments.edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(Number(id), dto)
  }

  @UseGuards(CurrentUserGuard, PermissionGuard)
  @RequirePermission('system.departments.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(Number(id))
  }
}
