import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { RefundSourceStageDto } from './create-refund-case.dto'

export enum RefundStatusQueryDto {
  PENDING_REVIEW = 'PENDING_REVIEW',
  PENDING_ASSIGNMENT = 'PENDING_ASSIGNMENT',
  PROCESSING = 'PROCESSING',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export class QueryRefundCasesDto {
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
  @IsEnum(RefundStatusQueryDto)
  status?: RefundStatusQueryDto

  @IsOptional()
  @IsEnum(RefundSourceStageDto)
  sourceStage?: RefundSourceStageDto
}
