

const BASEURL = 'https://www.otherman-records.com/index.php/api/releases'

// Interface of list API response
export interface ListItem {
  id: string;
  artist1: string;
  artist2: string;
  artist_glue: string;
  artist_name: string;
  title: string;
  text: string;
  jacket: string;
  jacket_path: string;
  date: string; // example: "2010/01/30"
  taglist: string[];
}

export interface ReleaseListApiResponse {
  count: number;
  [key: string]: number | ListItem; // Use index signature to allow any additional properties
}

// Interface of a single release
export interface Track {
  title: string;
  url: string;
  md5: string;
  mtime: string;
  creator: string;
  track: string;
}

export interface Release {
  id: string;
  title: string;
  jacket: string;
  jacket_path: string;
  date: string; // example: "2010/01/30"
  artist1: string;
  artist2: string;
  artist_glue: string;
  artist_name: string;
  drawer: string;
  archive: string;
  text: string;
  taglist: string[];
  tracklist: Track[];
}

const PAGE_SIZE = 12; // number of items per page

async function fetchPage(page: number): Promise<ReleaseListApiResponse> {
  const url = `${BASEURL}/list/${page}/sort/release-asc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  return await res.json() as ReleaseListApiResponse;
}

// Function to fetch list of releases
export async function fetchAllReleases(): Promise<ListItem[]> {
  const allReleases: ListItem[] = [];
  try {
    // Fetch the first page to get the total count
    const firstPage = await fetchPage(0);
    const totalCount = firstPage.count;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    allReleases.push(...Object.values(firstPage).filter(item => typeof item === 'object') as ListItem[]);

    // Fetch remaining pages
    for (let page = 1; page < totalPages; page++) {
      const pageData = await fetchPage(page);
      allReleases.push(...Object.values(pageData).filter(item => typeof item === 'object') as ListItem[]);
    }
  } catch (error) {
    console.error('Error fetching releases:', error);
    return [];
  }
  return allReleases;
}

// Function to get a specific release by ID
export async function fetchReleaseById(id: string): Promise<Release | null> {
  const url = `${BASEURL}/id/${id}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Error fetching release ${id}:`, res.statusText);
    return null;
  }
  return await res.json() as Release;
}
