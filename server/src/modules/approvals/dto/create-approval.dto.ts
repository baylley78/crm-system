import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export enum ApprovalTypeDto {
  REIMBURSEMENT = 'REIMBURSEMENT',
  LEAVE = 'LEAVE',
  PUNCH_CARD = 'PUNCH_CARD',
}

export class CreateApprovalDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customerId?: number

  @IsEnum(ApprovalTypeDto)
  approvalType: ApprovalTypeDto

  @IsString()
  @IsNotEmpty()
  title: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  leaveDays?: number

  @IsOptional()
  @IsDateString()
  punchDate?: string

  @IsOptional()
  @IsString()
  punchTime?: string

  @IsString()
  @IsNotEmpty()
  reason: string

  @IsOptional()
  @IsString()
  reimbursementAccountName?: string

  @IsOptional()
  @IsString()
  reimbursementPayeeName?: string

  @IsOptional()
  @IsString()
  reimbursementBankName?: string

  @IsOptional()
  @IsString()
  reimbursementCardNo?: string

  @IsOptional()
  @IsString()
  reimbursementVoucherUrl?: string

  @IsOptional()
  @IsString()
  remark?: string
}
