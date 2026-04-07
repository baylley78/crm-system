import { Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class SavePaymentAccountDto {
  @IsString()
  accountName: string

  @IsOptional()
  @IsString()
  bankName?: string

  @IsString()
  accountNo: string

  @IsOptional()
  @IsString()
  remark?: string

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean
}
