import { Type } from 'class-transformer'
import { IsBooleanString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class QueryCustomersDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  wechat?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  caseType?: string

  @IsOptional()
  @IsString()
  intentionLevel?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number

  @IsOptional()
  @IsBooleanString()
  isTailPaymentCompleted?: string

  @IsOptional()
  @IsBooleanString()
  hasApprovalRecord?: string

  @IsOptional()
  @IsBooleanString()
  hasQualityRecord?: string

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
}
