import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class FollowRefundCaseDto {
  @IsString()
  @IsNotEmpty()
  content: string

  @IsOptional()
  @IsString()
  remark?: string
}
