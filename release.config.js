module.exports = {
    extends: 'scratch-semantic-release-config',
    branches: [
        {
            name: 'develop'
            // default channel
        },
        {
            name: 'hotfix/*',
            channel: 'hotfix',
            prerelease: 'hotfix'
        }
    ]
};
