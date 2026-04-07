import { IsOptional, IsString } from 'class-validator'

export class ApprovalPayDto {
  @IsOptional()
  @IsString()
  remark?: string
}
