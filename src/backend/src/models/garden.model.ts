/**
 * Garden Model
 * @packageVersion 5.0
 * 
 * Implements the MongoDB schema and model for garden data with comprehensive validation
 * and optimization support. Addresses requirements for garden space optimization (F-001)
 * and related functional requirements.
 */

import { Schema, model, Document } from 'mongoose'; // @version 6.0.0
import { IGarden, IGardenZone } from '../interfaces/garden.interface';
import { IPlant } from '../interfaces/plant.interface';
import { 
    GARDEN_AREA_LIMITS,
    SUNLIGHT_CONDITIONS,
    MIN_ZONE_SIZE,
    SPACE_UTILIZATION_TARGET
} from '../constants/garden.constants';

/**
 * Extended interface for Garden document with Mongoose features
 */
interface IGardenDocument extends IGarden, Document {}

/**
 * Schema for plants within garden zones
 */
const PlantSchema = new Schema<IPlant>({
    id: { type: String, required: true },
    spacing: { 
        type: Number, 
        required: true,
        min: [1, 'Plant spacing must be at least 1 inch']
    }
}, { _id: false });

/**
 * Schema for garden zones with sunlight conditions
 */
const GardenZoneSchema = new Schema<IGardenZone>({
    id: { type: String, required: true },
    area: { 
        type: Number,
        required: true,
        min: [MIN_ZONE_SIZE, `Zone area must be at least ${MIN_ZONE_SIZE} sq ft`]
    },
    sunlightCondition: {
        type: String,
        required: true,
        enum: {
            values: Object.values(SUNLIGHT_CONDITIONS),
            message: 'Invalid sunlight condition'
        }
    },
    plants: [PlantSchema]
}, { _id: false });

/**
 * Main garden schema with validation and optimization support
 */
const GardenSchema = new Schema<IGardenDocument>({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    area: {
        type: Number,
        required: true,
        min: [
            GARDEN_AREA_LIMITS.MIN_AREA,
            `Garden area must be at least ${GARDEN_AREA_LIMITS.MIN_AREA} sq ft`
        ],
        max: [
            GARDEN_AREA_LIMITS.MAX_AREA,
            `Garden area cannot exceed ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`
        ],
        validate: {
            validator: function(area: number) {
                return Number.isFinite(area) && area > 0;
            },
            message: 'Garden area must be a positive number'
        }
    },
    zones: {
        type: [GardenZoneSchema],
        required: true,
        validate: [
            {
                validator: function(zones: IGardenZone[]) {
                    return zones.length > 0;
                },
                message: 'Garden must have at least one zone'
            },
            {
                validator: function(zones: IGardenZone[]) {
                    const totalZoneArea = zones.reduce((sum, zone) => sum + zone.area, 0);
                    return Math.abs(totalZoneArea - (this as IGardenDocument).area) < 0.01;
                },
                message: 'Total zone area must equal garden area'
            },
            {
                validator: function(zones: IGardenZone[]) {
                    const spaceUtilization = zones.reduce((sum, zone) => {
                        const zoneUtilization = zone.plants.reduce((plantSum, plant) => 
                            plantSum + (Math.PI * Math.pow(plant.spacing / 24, 2)), 0);
                        return sum + zoneUtilization;
                    }, 0) / this.area * 100;
                    
                    return spaceUtilization >= SPACE_UTILIZATION_TARGET;
                },
                message: `Space utilization must be at least ${SPACE_UTILIZATION_TARGET}%`
            }
        ]
    }
}, {
    timestamps: true,
    versionKey: false
});

// Indexes for query optimization
GardenSchema.index({ id: 1, 'zones.sunlightCondition': 1 });
GardenSchema.index({ 'zones.plants.id': 1 });
GardenSchema.index({ createdAt: 1 });
GardenSchema.index({ updatedAt: 1 });

// Virtual for calculating space utilization
GardenSchema.virtual('spaceUtilization').get(function(this: IGardenDocument) {
    return this.zones.reduce((sum, zone) => {
        const zoneUtilization = zone.plants.reduce((plantSum, plant) => 
            plantSum + (Math.PI * Math.pow(plant.spacing / 24, 2)), 0);
        return sum + zoneUtilization;
    }, 0) / this.area * 100;
});

// Pre-save middleware for validation
GardenSchema.pre('save', function(next) {
    if (this.isModified('zones')) {
        const uniqueZoneIds = new Set(this.zones.map(zone => zone.id));
        if (uniqueZoneIds.size !== this.zones.length) {
            next(new Error('Zone IDs must be unique'));
            return;
        }
    }
    next();
});

// Create and export the Garden model
export const Garden = model<IGardenDocument>('Garden', GardenSchema);