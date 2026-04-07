import { Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MinLength } from 'class-validator'
import { UserStatusDto } from './create-user.dto'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码长度不能少于6位' })
  password?: string

  @IsString()
  @IsNotEmpty()
  realName: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  departmentId?: number

  @IsNumber()
  @Type(() => Number)
  roleId: number

  @IsEnum(UserStatusDto)
  status: UserStatusDto
}
