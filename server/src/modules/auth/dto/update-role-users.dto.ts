import { Type } from 'class-transformer'
import { ArrayUnique, IsArray, IsNumber, IsOptional } from 'class-validator'

export class UpdateRoleUsersDto {
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  userIds: number[]

  @IsOptional()
  removeToFirstSales?: boolean
}
