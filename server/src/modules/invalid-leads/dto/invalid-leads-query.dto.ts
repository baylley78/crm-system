import { Type } from 'class-transformer'
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator'

export class InvalidLeadsQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string

  @IsDateString()
  @IsOptional()
  endDate?: string

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  departmentId?: number
}
