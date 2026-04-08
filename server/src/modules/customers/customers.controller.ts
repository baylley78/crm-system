import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/auth/current-user.decorator'
import { CurrentUserGuard } from '../../common/auth/current-user.guard'
import { PermissionGuard } from '../../common/auth/permission.guard'
import { RequirePermission } from '../../common/auth/require-permission.decorator'
import type { AuthenticatedUser } from '../auth/auth.service'
import { CustomersService } from './customers.service'
import { QueryCustomersDto } from './dto/query-customers.dto'
import { CreateCustomerFollowDto } from './dto/create-customer-follow.dto'
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto'

@Controller('customers')
@UseGuards(CurrentUserGuard, PermissionGuard)
@RequirePermission('customers.view')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(@CurrentUser() currentUser: AuthenticatedUser, @Query() query: QueryCustomersDto) {
    return this.customersService.findAll(currentUser, query)
  }

  @Get(':id')
  @RequirePermission('customers.read.performanceForm')
  findOne(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.findOne(currentUser, Number(id))
  }

  @Post(':id/follows')
  @RequirePermission('customers.follow')
  createFollow(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateCustomerFollowDto) {
    return this.customersService.createFollow(currentUser, Number(id), dto)
  }

  @Patch(':id/status')
  @RequirePermission('customers.status')
  updateStatus(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCustomerStatusDto) {
    return this.customersService.updateStatus(currentUser, Number(id), dto)
  }

  @Delete(':id')
  @RequirePermission('customers.delete')
  remove(@CurrentUser() currentUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.remove(currentUser, Number(id))
  }
}
