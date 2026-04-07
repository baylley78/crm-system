import { IsOptional, IsString } from 'class-validator'

export class CloseRefundCaseDto {
  @IsOptional()
  @IsString()
  remark?: string
}
