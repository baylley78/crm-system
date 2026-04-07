import { IsNotEmpty, IsString } from 'class-validator'

export class SearchJudicialComplaintCustomerDto {
  @IsString()
  @IsNotEmpty()
  phone: string
}
