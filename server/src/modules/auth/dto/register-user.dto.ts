import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MinLength } from 'class-validator'

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  realName: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '密码长度不能少于6位' })
  password: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  departmentId?: number
}
