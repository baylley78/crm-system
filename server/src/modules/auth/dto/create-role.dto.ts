import { Type } from 'class-transformer'
import { ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'
import { DataScopeDto } from './update-role-permissions.dto'

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: '角色编码只能使用大写字母、数字和下划线，且需以字母开头' })
  code: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(DataScopeDto)
  customerScope: DataScopeDto

  @IsEnum(DataScopeDto)
  reportScope: DataScopeDto

  @IsEnum(DataScopeDto)
  userManageScope: DataScopeDto

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  permissionIds?: number[]
}
