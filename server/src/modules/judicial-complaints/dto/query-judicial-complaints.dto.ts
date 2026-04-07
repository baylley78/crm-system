import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

export enum JudicialComplaintHandlingStatusQueryDto {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  HANDLED = 'HANDLED',
  IGNORED = 'IGNORED',
}

export class QueryJudicialComplaintsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number

  @IsOptional()
  @IsEnum(JudicialComplaintHandlingStatusQueryDto)
  handlingStatus?: JudicialComplaintHandlingStatusQueryDto
}
