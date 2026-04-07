import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parentId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  sort?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  leaderUserId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  hrUserId?: number
}
