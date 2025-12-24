import { Test, TestingModule } from "@nestjs/testing";
import { CorporationService } from "../../../src/modules/corporations/services/corporation.service";
import { CorporationDao } from "../../../src/modules/corporations/daos/corporation.dao";
import { CreateCorporationDto } from "../../../src/modules/corporations/dtos/create-corporation.dto";
import { UpdateCorporationDto } from "../../../src/modules/corporations/dtos/update-corporation.dto";
import { CorporationFiltersDto } from "../../../src/modules/corporations/dtos/corporation-filters.dto";
import { CorporationDto } from "../../../src/modules/corporations/dtos/corporation.dto";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

describe("CorporationService", () => {
  let service: CorporationService;
  let corporationDao: jest.Mocked<CorporationDao>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorporationService,
        {
          provide: CorporationDao,
          useValue: {
            createCorporation: jest.fn(),
            getCorporationById: jest.fn(),
            getCorporationByName: jest.fn(),
            getCorporations: jest.fn(),
            getActiveCorporations: jest.fn(),
            updateCorporation: jest.fn(),
            deleteCorporation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CorporationService>(CorporationService);
    corporationDao = module.get(CorporationDao);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createCorporation", () => {
    it("should create a corporation successfully", async () => {
      const createDto: CreateCorporationDto = {
        name: "Test Corp",
        industry: "technology",
        isActive: true,
      };

      const mockCorporationId = uuidv4();
      const mockCorporation: CorporationDto = {
        id: mockCorporationId,
        name: createDto.name,
        industry: createDto.industry,
        description: createDto.description,
        isActive: createDto.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationByName.mockResolvedValue(null);
      corporationDao.createCorporation.mockResolvedValue(mockCorporationId);
      corporationDao.getCorporationById.mockResolvedValue(mockCorporation);

      const result = await service.createCorporation(createDto);

      expect(result).toEqual(mockCorporation);
      expect(corporationDao.getCorporationByName).toHaveBeenCalledWith(
        createDto.name
      );
      expect(corporationDao.createCorporation).toHaveBeenCalledWith(createDto);
      expect(corporationDao.getCorporationById).toHaveBeenCalledWith(
        mockCorporationId
      );
    });

    it("should throw BadRequestException if corporation name already exists", async () => {
      const createDto: CreateCorporationDto = {
        name: "Existing Corp",
        industry: "technology",
      };

      corporationDao.getCorporationByName.mockResolvedValue({
        id: uuidv4(),
        name: "Existing Corp",
      } as CorporationDto);

      await expect(service.createCorporation(createDto)).rejects.toThrow(
        BadRequestException
      );
      expect(corporationDao.createCorporation).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if creation fails", async () => {
      const createDto: CreateCorporationDto = {
        name: "Test Corp",
        industry: "technology",
      };

      corporationDao.getCorporationByName.mockResolvedValue(null);
      corporationDao.createCorporation.mockResolvedValue(null);

      await expect(service.createCorporation(createDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw NotFoundException if corporation not found after creation", async () => {
      const createDto: CreateCorporationDto = {
        name: "Test Corp",
        industry: "technology",
      };

      const mockCorporationId = uuidv4();
      corporationDao.getCorporationByName.mockResolvedValue(null);
      corporationDao.createCorporation.mockResolvedValue(mockCorporationId);
      corporationDao.getCorporationById.mockResolvedValue(null);

      await expect(service.createCorporation(createDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("getCorporationById", () => {
    it("should return a corporation if found", async () => {
      const mockCorporation: CorporationDto = {
        id: uuidv4(),
        name: "Test Corp",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue(mockCorporation);

      const result = await service.getCorporationById(mockCorporation.id);

      expect(result).toEqual(mockCorporation);
      expect(corporationDao.getCorporationById).toHaveBeenCalledWith(
        mockCorporation.id
      );
    });

    it("should throw NotFoundException if corporation not found", async () => {
      const corporationId = uuidv4();
      corporationDao.getCorporationById.mockResolvedValue(null);

      await expect(service.getCorporationById(corporationId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("getCorporationByName", () => {
    it("should return a corporation if found", async () => {
      const mockCorporation: CorporationDto = {
        id: uuidv4(),
        name: "Test Corp",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationByName.mockResolvedValue(mockCorporation);

      const result = await service.getCorporationByName("Test Corp");

      expect(result).toEqual(mockCorporation);
      expect(corporationDao.getCorporationByName).toHaveBeenCalledWith(
        "Test Corp"
      );
    });

    it("should throw NotFoundException if corporation not found", async () => {
      corporationDao.getCorporationByName.mockResolvedValue(null);

      await expect(
        service.getCorporationByName("Non Existent")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getCorporations", () => {
    it("should return list of corporations", async () => {
      const mockCorporations: CorporationDto[] = [
        {
          id: uuidv4(),
          name: "Corp 1",
          industry: "technology",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          name: "Corp 2",
          industry: "finance",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      corporationDao.getCorporations.mockResolvedValue(mockCorporations);

      const result = await service.getCorporations();

      expect(result).toEqual(mockCorporations);
      expect(corporationDao.getCorporations).toHaveBeenCalledWith(undefined);
    });

    it("should apply filters when provided", async () => {
      const filters: CorporationFiltersDto = {
        industry: "technology",
        isActive: true,
      };

      const mockCorporations: CorporationDto[] = [
        {
          id: uuidv4(),
          name: "Tech Corp",
          industry: "technology",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      corporationDao.getCorporations.mockResolvedValue(mockCorporations);

      const result = await service.getCorporations(filters);

      expect(result).toEqual(mockCorporations);
      expect(corporationDao.getCorporations).toHaveBeenCalledWith(filters);
    });
  });

  describe("getActiveCorporations", () => {
    it("should return only active corporations", async () => {
      const mockCorporations: CorporationDto[] = [
        {
          id: uuidv4(),
          name: "Active Corp",
          industry: "technology",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      corporationDao.getActiveCorporations.mockResolvedValue(mockCorporations);

      const result = await service.getActiveCorporations();

      expect(result).toEqual(mockCorporations);
      expect(corporationDao.getActiveCorporations).toHaveBeenCalled();
    });
  });

  describe("updateCorporation", () => {
    it("should update a corporation successfully", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Old Name",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateCorporationDto = {
        name: "New Name",
        description: "New description",
      };

      const updatedCorp: CorporationDto = {
        ...existingCorp,
        ...updateDto,
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById
        .mockResolvedValueOnce(existingCorp)
        .mockResolvedValueOnce(updatedCorp);
      corporationDao.updateCorporation.mockResolvedValue(true);

      const result = await service.updateCorporation(corporationId, updateDto);

      expect(result).toEqual(updatedCorp);
      expect(corporationDao.updateCorporation).toHaveBeenCalledWith(
        corporationId,
        updateDto
      );
    });

    it("should throw NotFoundException if corporation not found", async () => {
      const corporationId = uuidv4();
      const updateDto: UpdateCorporationDto = {
        name: "New Name",
      };

      corporationDao.getCorporationById.mockResolvedValue(null);

      await expect(
        service.updateCorporation(corporationId, updateDto)
      ).rejects.toThrow(NotFoundException);
      expect(corporationDao.updateCorporation).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if name conflict exists", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Old Name",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateCorporationDto = {
        name: "Conflicting Name",
      };

      const conflictingCorp: CorporationDto = {
        id: uuidv4(), // Different ID
        name: "Conflicting Name",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue(existingCorp);
      corporationDao.getCorporationByName.mockResolvedValue(conflictingCorp);

      await expect(
        service.updateCorporation(corporationId, updateDto)
      ).rejects.toThrow(BadRequestException);
      expect(corporationDao.updateCorporation).not.toHaveBeenCalled();
    });

    it("should allow updating to same name", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Same Name",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateCorporationDto = {
        name: "Same Name", // Same name
        description: "Updated description",
      };

      corporationDao.getCorporationById
        .mockResolvedValueOnce(existingCorp)
        .mockResolvedValueOnce({ ...existingCorp, ...updateDto });
      corporationDao.updateCorporation.mockResolvedValue(true);

      const result = await service.updateCorporation(corporationId, updateDto);

      expect(result.description).toBe("Updated description");
      expect(corporationDao.updateCorporation).toHaveBeenCalled();
    });

    it("should throw BadRequestException if update fails", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Test Corp",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto: UpdateCorporationDto = {
        name: "New Name",
      };

      corporationDao.getCorporationById.mockResolvedValue(existingCorp);
      corporationDao.getCorporationByName.mockResolvedValue(null);
      corporationDao.updateCorporation.mockResolvedValue(false);

      await expect(
        service.updateCorporation(corporationId, updateDto)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteCorporation", () => {
    it("should delete a corporation successfully", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Test Corp",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue(existingCorp);
      corporationDao.deleteCorporation.mockResolvedValue(true);

      await service.deleteCorporation(corporationId);

      expect(corporationDao.deleteCorporation).toHaveBeenCalledWith(
        corporationId
      );
    });

    it("should throw NotFoundException if corporation not found", async () => {
      const corporationId = uuidv4();
      corporationDao.getCorporationById.mockResolvedValue(null);

      await expect(service.deleteCorporation(corporationId)).rejects.toThrow(
        NotFoundException
      );
      expect(corporationDao.deleteCorporation).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if deletion fails", async () => {
      const corporationId = uuidv4();
      const existingCorp: CorporationDto = {
        id: corporationId,
        name: "Test Corp",
        industry: "technology",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      corporationDao.getCorporationById.mockResolvedValue(existingCorp);
      corporationDao.deleteCorporation.mockResolvedValue(false);

      await expect(service.deleteCorporation(corporationId)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});

