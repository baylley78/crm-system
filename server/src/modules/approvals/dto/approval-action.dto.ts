import { IsEnum, IsOptional, IsString } from 'class-validator'

export enum ApprovalActionTypeDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ApprovalActionDto {
  @IsEnum(ApprovalActionTypeDto)
  action: ApprovalActionTypeDto

  @IsOptional()
  @IsString()
  remark?: string
}
