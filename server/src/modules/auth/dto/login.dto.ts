import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone: string

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: '密码长度不能少于6位' })
  password: string
}
