import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CopyRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  code: string

  @IsOptional()
  @IsString()
  description?: string
}
