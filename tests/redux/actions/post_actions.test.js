// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import {Posts} from 'mattermost-redux/constants';

import * as Actions from 'actions/post_actions';
import {Constants, ActionTypes} from 'utils/constants';

const mockStore = configureStore([thunk]);

jest.mock('mattermost-redux/actions/posts', () => ({
    addReaction: (...args) => ({type: 'MOCK_ADD_REACTION', args}),
    createPost: (...args) => ({type: 'MOCK_CREATE_POST', args}),
    createPostImmediately: (...args) => ({type: 'MOCK_CREATE_POST_IMMEDIATELY', args}),
    getPosts: (...args) => ({type: 'MOCK_GET_POSTS', args}),
    getPostsBefore: (...args) => ({type: 'MOCK_GET_POSTS_BEFORE', args}),
}));

jest.mock('actions/emoji_actions', () => ({
    addRecentEmoji: (...args) => ({type: 'MOCK_ADD_RECENT_EMOJI', args}),
}));

jest.mock('actions/storage', () => ({
    setGlobalItem: (...args) => ({type: 'MOCK_SET_GLOBAL_ITEM', args}),
}));

jest.mock('utils/user_agent', () => ({
    isIosClassic: jest.fn().mockReturnValueOnce(true).mockReturnValue(false),
}));

const RECEIVED_POSTS = {
    channelId: 'current_channel_id',
    data: {order: [], posts: {new_post_id: {channel_id: 'current_channel_id', id: 'new_post_id', message: 'new message', type: ''}}},
    type: 'RECEIVED_POSTS',
};
const INCREASED_POST_VISIBILITY = {amount: 1, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'};

function getReceivedPosts(post) {
    const receivedPosts = {...RECEIVED_POSTS};
    if (post) {
        receivedPosts.data.posts[post.id] = post;
    }

    return receivedPosts;
}

describe('Actions.Posts', () => {
    const latestPost = {
        id: 'latest_post_id',
        user_id: 'current_user_id',
        message: 'test msg',
        channel_id: 'current_channel_id',
        type: 'normal,',
    };
    const initialState = {
        entities: {
            posts: {
                posts: {
                    [latestPost.id]: latestPost,
                },
                postsInChannel: {
                    current_channel_id: [latestPost.id],
                },
                postsInThread: {},
                messagesHistory: {
                    index: {
                        [Posts.MESSAGE_TYPES.COMMENT]: 0,
                    },
                    messages: ['test message'],
                },
            },
            channels: {
                currentChannelId: 'current_channel_id',
                myMembers: {
                    [latestPost.channel_id]: {
                        channel_id: 'current_channel_id',
                        user_id: 'current_user_id',
                        roles: 'channel_role',
                    },
                },
                channels: {
                    current_channel_id: {team_id: 'team_id'},
                },
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        user_id: 'current_user_id',
                        value: 'username',
                    },
                },
            },
            teams: {
                currentTeamId: 'team-1',
                teams: {
                    team_id: {
                        id: 'team_id',
                        name: 'team-1',
                        displayName: 'Team 1',
                    },
                },
                myMembers: {
                    'team-1': {roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'current_username',
                        roles: 'system_role',
                        useAutomaticTimezone: true,
                        automaticTimezone: '',
                        manualTimezone: '',
                    },
                },
            },
            general: {
                license: {IsLicensed: 'false'},
                serverVersion: '5.4.0',
                config: {PostEditTimeLimit: -1},
            },
            roles: {
                roles: {
                    system_role: {
                        permissions: ['edit_post'],
                    },
                    team_role: {
                        permissions: [],
                    },
                    channel_role: {
                        permissions: [],
                    },
                },
            },
            emojis: {customEmoji: {}},
        },
        views: {
            posts: {
                editingPost: {},
            },
            channel: {
                loadingPosts: {},
                postVisibility: {current_channel_id: 60},
            },
            rhs: {searchTerms: ''},
        },
    };

    test('handleNewPost', async () => {
        const testStore = await mockStore(initialState);
        const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message', type: Constants.PostTypes.ADD_TO_CHANNEL};
        const msg = {data: {team_id: 'team_id', mentions: ['current_user_id']}};

        await testStore.dispatch(Actions.handleNewPost(newPost, msg));
        expect(testStore.getActions()).toEqual([INCREASED_POST_VISIBILITY, getReceivedPosts(newPost)]);
    });

    test('setEditingPost', async () => {
        // should allow to edit and should fire an action
        let testStore = mockStore({...initialState});
        const {data} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 0, 'test', 'title'));
        expect(data).toEqual(true);

        expect(testStore.getActions()).toEqual(
            [{data: {commentCount: 0, isRHS: false, postId: 'latest_post_id', refocusId: 'test', title: 'title'}, type: ActionTypes.SHOW_EDIT_POST_MODAL}]
        );

        const general = {
            license: {IsLicensed: 'true'},
            serverVersion: '5.4.0',
            config: {PostEditTimeLimit: -1},
        };
        const withLicenseState = {...initialState};
        withLicenseState.entities.general = general;

        testStore = mockStore(withLicenseState);

        const {data: withLicenseData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 0, 'test', 'title'));
        expect(withLicenseData).toEqual(true);
        expect(testStore.getActions()).toEqual(
            [{data: {commentCount: 0, isRHS: false, postId: 'latest_post_id', refocusId: 'test', title: 'title'}, type: ActionTypes.SHOW_EDIT_POST_MODAL}]
        );

        // should not allow edit for pending post
        const newLatestPost = {...latestPost, pending_post_id: latestPost.id};
        const withPendingPostState = {...initialState};
        withPendingPostState.entities.posts.posts[latestPost.id] = newLatestPost;

        testStore = mockStore(withPendingPostState);

        const {data: withPendingPostData} = await testStore.dispatch(Actions.setEditingPost('latest_post_id', 0, 'test', 'title'));
        expect(withPendingPostData).toEqual(false);
        expect(testStore.getActions()).toEqual([]);
    });

    test('hideEditPostModal', async () => {
        const testStore = await mockStore(initialState);

        await testStore.dispatch(Actions.hideEditPostModal());
        expect(testStore.getActions()).toEqual([{type: ActionTypes.HIDE_EDIT_POST_MODAL}]);
    });

    test('increasePostVisibility', async () => {
        const testStore = await mockStore(initialState);

        await testStore.dispatch(Actions.increasePostVisibility('current_channel_id'));
        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: [
                    {channelId: 'current_channel_id', data: true, type: 'LOADING_POSTS'},
                    {amount: 30, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'},
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {args: ['current_channel_id', 2, 30], type: 'MOCK_GET_POSTS'},
            {channelId: 'current_channel_id', data: false, type: 'LOADING_POSTS'},
        ]);

        await testStore.dispatch(Actions.increasePostVisibility('current_channel_id', 'latest_post_id'));
        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: [
                    {channelId: 'current_channel_id', data: true, type: 'LOADING_POSTS'},
                    {amount: 30, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'},
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {args: ['current_channel_id', 2, 30], type: 'MOCK_GET_POSTS'},
            {channelId: 'current_channel_id', data: false, type: 'LOADING_POSTS'},
            {
                meta: {batch: true},
                payload: [
                    {channelId: 'current_channel_id', data: true, type: 'LOADING_POSTS'},
                    {amount: 30, data: 'current_channel_id', type: 'INCREASE_POST_VISIBILITY'},
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {
                args: ['current_channel_id', 'latest_post_id', 2, 30],
                type: 'MOCK_GET_POSTS_BEFORE',
            },
            {channelId: 'current_channel_id', data: false, type: 'LOADING_POSTS'},
        ]);
    });

    test('searchForTerm', async () => {
        const testStore = await mockStore(initialState);

        await testStore.dispatch(Actions.searchForTerm('hello'));
        expect(testStore.getActions()).toEqual([
            {terms: 'hello', type: 'UPDATE_RHS_SEARCH_TERMS'},
            {state: 'search', type: 'UPDATE_RHS_STATE'},
            {terms: '', type: 'UPDATE_RHS_SEARCH_RESULTS_TERMS'},
            {isGettingMore: false, type: 'SEARCH_POSTS_REQUEST'},
        ]);
    });

    test('createPost', async () => {
        const testStore = await mockStore(initialState);
        const newPost = {id: 'new_post_id', channel_id: 'current_channel_id', message: 'new message'};
        const newReply = {id: 'reply_post_id', channel_id: 'current_channel_id', message: 'new message', root_id: 'new_post_id'};
        const files = [];

        const immediateExpectedState = [{
            args: [newPost, files],
            type: 'MOCK_CREATE_POST_IMMEDIATELY',
        }, {
            args: ['draft_current_channel_id', null],
            type: 'MOCK_SET_GLOBAL_ITEM',
        }];

        await testStore.dispatch(Actions.createPost(newPost, files));
        expect(testStore.getActions()).toEqual(immediateExpectedState);

        const finalExpectedState = [
            ...immediateExpectedState,
            {
                args: [newReply, files],
                type: 'MOCK_CREATE_POST',
            }, {
                args: ['comment_draft_new_post_id', null],
                type: 'MOCK_SET_GLOBAL_ITEM',
            },
        ];

        await testStore.dispatch(Actions.createPost(newReply, files));
        expect(testStore.getActions()).toEqual(finalExpectedState);
    });

    test('addReaction', async () => {
        const testStore = await mockStore(initialState);

        await testStore.dispatch(Actions.addReaction('post_id_1', 'emoji_name_1'));
        expect(testStore.getActions()).toEqual([
            {args: ['post_id_1', 'emoji_name_1'], type: 'MOCK_ADD_REACTION'},
            {args: ['emoji_name_1'], type: 'MOCK_ADD_RECENT_EMOJI'},
        ]);
    });
});
