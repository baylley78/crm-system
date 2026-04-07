import { Type } from 'class-transformer'
import { IsNumber } from 'class-validator'

export class TransferToThirdSalesDto {
  @IsNumber()
  @Type(() => Number)
  customerId: number
}
