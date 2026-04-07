import { Type } from 'class-transformer'
import { ArrayUnique, IsArray, IsEnum, IsNumber } from 'class-validator'

export enum DataScopeDto {
  SELF = 'SELF',
  DEPARTMENT = 'DEPARTMENT',
  DEPARTMENT_AND_CHILDREN = 'DEPARTMENT_AND_CHILDREN',
  ALL = 'ALL',
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  permissionIds: number[]

  @IsEnum(DataScopeDto)
  customerScope: DataScopeDto

  @IsEnum(DataScopeDto)
  reportScope: DataScopeDto

  @IsEnum(DataScopeDto)
  userManageScope: DataScopeDto
}
