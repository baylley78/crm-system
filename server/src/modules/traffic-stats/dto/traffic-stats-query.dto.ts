import { Type } from 'class-transformer'
import { IsDateString, IsOptional, IsNumber, Min } from 'class-validator'

export class TrafficStatsQueryDto {
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
