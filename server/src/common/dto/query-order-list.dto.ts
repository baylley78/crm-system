import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class QueryOrderListDto {
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
  @Type(() => String)
  @IsString()
  paymentAccountName?: string

  @IsOptional()
  @Type(() => String)
  @IsString()
  paymentSerialNo?: string

  @IsOptional()
  @Type(() => String)
  @IsString()
  tailPaymentSerialNo?: string
}
