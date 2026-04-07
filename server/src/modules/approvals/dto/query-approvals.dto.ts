import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator'
import { ApprovalTypeDto } from './create-approval.dto'

export class QueryApprovalsDto {
  @IsOptional()
  @IsEnum(ApprovalTypeDto)
  approvalType?: ApprovalTypeDto

  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'PROCESSED', 'UNPAID', 'PAID'])
  statusView?: 'ALL' | 'PENDING' | 'PROCESSED' | 'UNPAID' | 'PAID'

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH'])
  quickRange?: 'DAY' | 'WEEK' | 'MONTH'
}
