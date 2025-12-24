import { Business } from "../classes/business.class";
import { BusinessInputDto } from "../dtos/business-input.dto";

/**
 * Interface for special business behaviors
 * Most businesses use standard behavior, but some need custom logic
 */
export interface IBusinessStrategy {
  /**
   * Custom validation before claiming outputs
   * Return void if valid, throw error if invalid
   */
  validateClaim?(
    business: Business,
    outputId: string,
    cycles: number,
  ): Promise<void>;

  /**
   * Custom input validation
   * Can override standard input checking
   */
  validateInputs?(
    business: Business,
    inputs: BusinessInputDto[],
    cycles: number,
  ): Promise<void>;

  /**
   * Custom status information
   * Can add business-specific status fields
   */
  getStatus?(business: Business): Promise<Record<string, any>>;
}

