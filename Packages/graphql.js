// Fetch detailed image metadata
export async function fetchImageMetadata(imageId) {
    const query = `query FindImage($id: ID!) {
        findImage(id: $id) {
            id
            title
            rating100
            o_counter
            organized
            date
            details
            photographer
            files {
                basename
            }
            tags {
                id
                name
            }
            performers {
                id
                name
            }
            studio {
                id
                name
            }
            galleries {
                id
                title
            }
            paths {
                thumbnail
                image
            }
        }
    }`;

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: imageId } })
        });

        const data = await response.json();
        return data?.data?.findImage || null;
    } catch (error) {
        console.error('[Image Deck] Error fetching image metadata:', error);
        return null;
    }
}

// Update image metadata
export async function updateImageMetadata(imageId, updates) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            rating100
            title
            details
            organized
        }
    }`;

    const input = { id: imageId, ...updates };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.imageUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating image metadata:', error);
        return null;
    }
}

// Add/remove tags from image
export async function updateImageTags(imageId, tagIds) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            tags {
                id
                name
            }
        }
    }`;

    const input = { id: imageId, tag_ids: tagIds };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { input } })
        });

        const data = await response.json();
        return data?.data?.imageUpdate || null;
    } catch (error) {
        console.error('[Image Deck] Error updating image tags:', error);
        return null;
    }
}

// Search for tags
export async function searchTags(query) {
    const gql = `query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
            tags {
                id
                name
            }
        }
    }`;

    const variables = {
        filter: { per_page: 20, q: query },
        tag_filter: {}
    };

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gql, variables })
        });

        const data = await response.json();
        return data?.data?.findTags?.tags || [];
    } catch (error) {
        console.error('[Image Deck] Error searching tags:', error);
        return [];
    }
}
