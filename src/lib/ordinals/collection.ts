import config from "../../../marketplace.config";

/**
 * Collection metadata and utilities
 */

export interface CollectionMetadata {
  name: string;
  slug: string;
  description: string;
  artist: string;
  totalSupply: number;
  colors: string[];
  parentCount: number;
  grandparentId: string;
}

/**
 * Get collection metadata from config
 */
export function getCollectionMetadata(): CollectionMetadata {
  return {
    name: config.collection.name,
    slug: config.collection.slug,
    description: config.collection.description,
    artist: config.collection.artist,
    totalSupply: config.collection.totalSupply,
    colors: config.collection.colors,
    parentCount: config.collection.parentInscriptionIds.length,
    grandparentId: config.collection.grandparentId,
  };
}

/**
 * Get all configured parent inscription IDs
 */
export function getParentInscriptionIds(): string[] {
  return config.collection.parentInscriptionIds;
}

/**
 * Format collection stats for display
 */
export function getCollectionStats() {
  return {
    totalSupply: config.collection.totalSupply,
    colorCount: config.collection.colors.length - 1, // exclude mystery
    hasMysteryColor: true,
    parentCount: config.collection.parentInscriptionIds.length,
  };
}
