import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase.ts';

export interface PublicProfileRecord {
  ownerUid: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface FollowingRecord extends PublicProfileRecord {
  id?: string;
  followedAt?: unknown;
}

export interface SharedWatchlistMeta {
  ownerUid: string;
  enabled: boolean;
  listName: string;
  updatedAt?: unknown;
}

export type SharedMediaType = 'movie' | 'tv';

export interface SharedWatchlistItem {
  id: string;
  movieId: number;
  mediaType: SharedMediaType;
  title: string;
  posterPath: string;
  releaseDate?: string;
  genres: string[];
  addedAt?: unknown;
}

export interface SocialActivity {
  id: string;
  type: 'shared_watchlist_item_added';
  actorUid: string;
  actorName: string;
  title: string;
  movieId: number;
  mediaType: SharedMediaType;
  posterPath?: string;
  listName: string;
  createdAt?: unknown;
}

export class SocialServiceError extends Error {
  code: 'user-not-found' | 'self-follow' | 'already-following' | 'sharing-disabled';

  constructor(code: SocialServiceError['code'], message: string) {
    super(message);
    this.name = 'SocialServiceError';
    this.code = code;
  }
}

const SEARCH_RESULT_LIMIT = 10;
export const SHARED_LIST_ID = 'main';
export const SHARED_LIST_NAME = 'Shared watchlist';

const profileRef = (uid: string) => doc(db, 'users', uid);
const publicProfilesRef = collection(db, 'publicProfiles');
const publicProfileRef = (uid: string) => doc(db, 'publicProfiles', uid);
const followingCollectionRef = (uid: string) => collection(db, 'users', uid, 'following');
const followingRef = (viewerUid: string, ownerUid: string) => doc(db, 'users', viewerUid, 'following', ownerUid);
const sharedMetaRef = (ownerUid: string) => doc(db, 'users', ownerUid, 'sharedWatchlists', SHARED_LIST_ID);
const sharedItemsRef = (ownerUid: string) => collection(db, 'users', ownerUid, 'sharedWatchlists', SHARED_LIST_ID, 'items');
const sharedItemRef = (ownerUid: string, itemId: string) => doc(db, 'users', ownerUid, 'sharedWatchlists', SHARED_LIST_ID, 'items', itemId);
const activityCollectionRef = (ownerUid: string) => collection(db, 'users', ownerUid, 'activity');

const normalizeSearchTerm = (value: string) => value.trim().replace(/^@/, '').toLowerCase();

const readPublicProfile = async (user: User): Promise<PublicProfileRecord> => {
  const snapshot = await getDoc(profileRef(user.uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  const username = typeof data.handle === 'string' ? data.handle.trim().replace(/^@/, '').slice(0, 32) : '';
  const displayName = String(data.username || data.displayName || data.name || user.displayName || 'Cinescape user').trim().slice(0, 100);
  return {
    ownerUid: user.uid,
    displayName: displayName || 'Cinescape user',
    username,
    avatarUrl: typeof data.photoURL === 'string' ? data.photoURL : user.photoURL || null,
  };
};

/** Sync only the minimal name, username, and avatar fields needed by client-side search. */
export const syncPublicDirectoryProfile = async (user: User): Promise<PublicProfileRecord> => {
  const profile = await readPublicProfile(user);
  await setDoc(publicProfileRef(user.uid), {
    ...profile,
    displayNameSearch: normalizeSearchTerm(profile.displayName),
    usernameSearch: normalizeSearchTerm(profile.username),
    updatedAt: serverTimestamp(),
  });
  return profile;
};

/** Prefix search on display name and username. Email is deliberately not indexed or returned. */
export const searchPublicProfiles = async (rawTerm: string, excludedUid: string): Promise<PublicProfileRecord[]> => {
  const term = normalizeSearchTerm(rawTerm);
  if (term.length < 2) return [];
  const prefixEnd = `${term}\uf8ff`;
  const [nameSnapshot, usernameSnapshot] = await Promise.all([
    getDocs(query(publicProfilesRef, orderBy('displayNameSearch'), startAt(term), endAt(prefixEnd), limit(SEARCH_RESULT_LIMIT))),
    getDocs(query(publicProfilesRef, orderBy('usernameSearch'), startAt(term), endAt(prefixEnd), limit(SEARCH_RESULT_LIMIT))),
  ]);

  const profiles = new Map<string, PublicProfileRecord>();
  [...nameSnapshot.docs, ...usernameSnapshot.docs].forEach((entry) => {
    const data = entry.data();
    if (entry.id === excludedUid || typeof data.displayName !== 'string') return;
    profiles.set(entry.id, {
      ownerUid: entry.id,
      displayName: data.displayName,
      username: typeof data.username === 'string' ? data.username : '',
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    });
  });

  return Array.from(profiles.values())
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(0, SEARCH_RESULT_LIMIT);
};

export const followUser = async (viewerUid: string, ownerUid: string): Promise<FollowingRecord> => {
  if (viewerUid === ownerUid) throw new SocialServiceError('self-follow', 'You cannot follow your own account.');
  const edgeRef = followingRef(viewerUid, ownerUid);

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(edgeRef);
    if (existing.exists()) throw new SocialServiceError('already-following', 'You already follow this person.');
    const profileSnapshot = await transaction.get(publicProfileRef(ownerUid));
    if (!profileSnapshot.exists()) throw new SocialServiceError('user-not-found', 'That profile could not be found.');
    const data = profileSnapshot.data();
    if (typeof data.displayName !== 'string') throw new SocialServiceError('user-not-found', 'That profile could not be found.');

    const record: FollowingRecord = {
      ownerUid,
      displayName: data.displayName,
      username: typeof data.username === 'string' ? data.username : '',
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
      followedAt: serverTimestamp(),
    };
    transaction.set(edgeRef, record);
    return record;
  });
};

export const unfollowUser = (viewerUid: string, ownerUid: string) => deleteDoc(followingRef(viewerUid, ownerUid));

export const subscribeFollowing = (
  viewerUid: string,
  onData: (records: FollowingRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  followingCollectionRef(viewerUid),
  (snapshot) => {
    const records = snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        ...data,
        id: entry.id,
        ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : entry.id,
        displayName: typeof data.displayName === 'string' ? data.displayName : 'Cinescape user',
        username: typeof data.username === 'string' ? data.username : '',
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
      } as FollowingRecord;
    });
    records.sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
    onData(records);
  },
  (error) => onError(error),
);

export const setSharedWatchlistEnabled = (ownerUid: string, enabled: boolean, listName = SHARED_LIST_NAME) => setDoc(
  sharedMetaRef(ownerUid),
  { ownerUid, enabled, listName: listName.trim().slice(0, 40) || SHARED_LIST_NAME, updatedAt: serverTimestamp() },
  { merge: true },
);

export const subscribeSharedWatchlistMeta = (
  ownerUid: string,
  onData: (meta: SharedWatchlistMeta | null) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  sharedMetaRef(ownerUid),
  (snapshot) => onData(snapshot.exists() ? ({ ownerUid, ...snapshot.data() } as SharedWatchlistMeta) : null),
  (error) => onError(error),
);

const toSharedItem = (data: Record<string, any>): SharedWatchlistItem | null => {
  const movieId = Number(data.movieId ?? data.mediaId ?? data.id);
  if (!Number.isFinite(movieId) || movieId <= 0) return null;
  const mediaType: SharedMediaType = data.mediaType === 'tv' || data.type === 'tv' ? 'tv' : 'movie';
  const id = `${mediaType}-${movieId}`;
  return {
    id,
    movieId,
    mediaType,
    title: String(data.title || data.name || 'Untitled'),
    posterPath: typeof data.posterPath === 'string' ? data.posterPath : typeof data.poster_path === 'string' ? data.poster_path : '',
    releaseDate: String(data.releaseDate || data.first_air_date || data.release_date || ''),
    genres: Array.isArray(data.genres) ? data.genres.filter((genre: unknown): genre is string => typeof genre === 'string') : [],
    addedAt: data.addedAt,
  };
};

export const subscribeOwnerWatchlist = (
  ownerUid: string,
  onData: (items: SharedWatchlistItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  collection(db, 'users', ownerUid, 'watchlist'),
  (snapshot) => {
    const items = snapshot.docs
      .map((entry) => toSharedItem(entry.data()))
      .filter((item): item is SharedWatchlistItem => item !== null);
    items.sort((a, b) => a.title.localeCompare(b.title));
    onData(items);
  },
  (error) => onError(error),
);

export const subscribeSharedWatchlist = (
  ownerUid: string,
  onData: (items: SharedWatchlistItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(sharedItemsRef(ownerUid), orderBy('addedAt', 'desc')),
  (snapshot) => {
    const items = snapshot.docs
      .map((entry) => toSharedItem(entry.data()))
      .filter((item): item is SharedWatchlistItem => item !== null);
    onData(items);
  },
  (error) => onError(error),
);

export const addSharedWatchlistItem = async (
  ownerUid: string,
  actorName: string,
  source: SharedWatchlistItem,
  listName = SHARED_LIST_NAME,
): Promise<boolean> => {
  const itemId = `${source.mediaType}-${source.movieId}`;
  const itemRef = sharedItemRef(ownerUid, itemId);
  const metaRef = sharedMetaRef(ownerUid);
  const activityRef = doc(activityCollectionRef(ownerUid));

  return runTransaction(db, async (transaction) => {
    const metaSnapshot = await transaction.get(metaRef);
    if (!metaSnapshot.exists() || metaSnapshot.data().enabled !== true) {
      throw new SocialServiceError('sharing-disabled', 'Turn on sharing before adding titles.');
    }
    const itemSnapshot = await transaction.get(itemRef);
    if (itemSnapshot.exists()) return false;

    const item: SharedWatchlistItem = {
      id: itemId,
      movieId: source.movieId,
      mediaType: source.mediaType,
      title: source.title,
      posterPath: source.posterPath || '',
      releaseDate: source.releaseDate || '',
      genres: source.genres || [],
      addedAt: serverTimestamp(),
    };
    transaction.set(itemRef, item);
    transaction.set(activityRef, {
      type: 'shared_watchlist_item_added',
      actorUid: ownerUid,
      actorName: actorName || 'Cinescape user',
      title: item.title,
      movieId: item.movieId,
      mediaType: item.mediaType,
      ...(item.posterPath ? { posterPath: item.posterPath } : {}),
      listName,
      createdAt: serverTimestamp(),
    });
    return true;
  });
};

export const removeSharedWatchlistItem = (ownerUid: string, itemId: string) => deleteDoc(sharedItemRef(ownerUid, itemId));

export const subscribeSocialActivity = (
  ownerUid: string,
  onData: (events: SocialActivity[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(
  query(activityCollectionRef(ownerUid), orderBy('createdAt', 'desc'), limit(16)),
  (snapshot) => {
    const events = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() } as SocialActivity))
      .filter((event) => event.type === 'shared_watchlist_item_added');
    onData(events);
  },
  (error) => onError(error),
);
