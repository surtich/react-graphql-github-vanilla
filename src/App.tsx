import axios, { AxiosError, AxiosResponse } from "axios";
import React, { Component } from "react";

const axiosGitHubGraphQL = axios.create({
  baseURL: "https://api.github.com/graphql",
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`
  }
});

const ADD_STAR = `
  mutation ($repositoryId: ID!) {
    addStar(input:{starrableId:$repositoryId}) {
      starrable {
        viewerHasStarred
      }
    }
  }
`;

const GET_ISSUES_OF_REPOSITORY = `
  query ($organization: String!, $repository: String!, $cursor: String) {
    organization(login: $organization) {
      name
      url
      repository(name: $repository) {
        id
        name
        url
        stargazers {
          totalCount
        }
        viewerHasStarred
        issues(first: 5, after: $cursor, states: [OPEN]) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          edges {
            node {
              id
              title
              url
              reactions(last: 3) {
                edges {
                  node {
                    id
                    content
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const getIssuesOfRepository = (path: string, cursor?: string) => {
  const [organization, repository] = path.split("/");
  return axiosGitHubGraphQL.post("", {
    query: GET_ISSUES_OF_REPOSITORY,
    variables: { organization, repository, cursor }
  });
};

const addStarToRepository = (repositoryId: string) => {
  return axiosGitHubGraphQL.post("", {
    query: ADD_STAR,
    variables: { repositoryId }
  });
};

const resolveIssuesQuery = (
  queryResult: IQueryResult,
  state: AppState,
  cursor?: string
) => {
  const { data, errors } = queryResult.data;
  if (!cursor) {
    return {
      organization: data.organization,
      errors
    };
  }
  const { edges: oldIssues } = state.organization!.repository.issues;
  const { edges: newIssues } = data.organization.repository.issues;
  const updatedIssues = [...oldIssues, ...newIssues];
  return {
    organization: {
      ...data.organization,
      repository: {
        ...data.organization.repository,
        issues: {
          ...data.organization.repository.issues,
          edges: updatedIssues
        }
      }
    },
    errors
  } as AppState;
};

const resolveAddStarMutation = (mutationResult: any) => (state: AppState) => {
  const { viewerHasStarred } = mutationResult.data.data.addStar.starrable;

  const { totalCount } = state.organization!.repository.stargazers;

  return {
    ...state,
    organization: {
      ...state.organization,
      repository: {
        ...state.organization!.repository,
        viewerHasStarred,
        stargazers: {
          totalCount: totalCount + 1
        }
      }
    }
  } as AppState;
};

const TITLE = "React GraphQL GitHub Client";

type StarRepository = (repositoryId: string, viewerHasStarred: boolean) => void;

type IPage<T> = {
  readonly edges: [
    {
      readonly node: T;
    }
  ];
  readonly totalConunt: number;
  readonly pageInfo: {
    readonly endCursor: string;
    readonly hasNextPage: boolean;
  };
};

type IReaction = {
  readonly id: string;
  readonly content: string;
};

type IIssue = {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly reactions: IPage<IReaction>;
};

type IRepository = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly stargazers: {
    totalCount: number;
  };
  readonly viewerHasStarred: boolean;
  readonly issues: IPage<IIssue>;
};

type IOrganization = {
  readonly name: string;
  readonly url: string;
  readonly repository: IRepository;
};

type IError = {
  message: string;
};

type IQueryResult = AxiosResponse<{
  data: { organization: IOrganization };
  errors: IError[];
}>;

type AppState = {
  readonly path?: string;
  readonly organization?: IOrganization | null;
  readonly errors?: IError[];
};
class App extends Component<{}, AppState> {
  state = {
    path: "the-road-to-learn-react/the-road-to-learn-react",
    organization: null,
    errors: []
  };
  componentDidMount() {
    this.onFetchFromGitHub(this.state.path);
  }
  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ path: event.target.value });
  };
  onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    this.onFetchFromGitHub(this.state.path);
    event.preventDefault();
  };

  onFetchMoreIssues = () => {
    if (this.state.organization) {
      const { endCursor } = ((this.state
        .organization as any) as IOrganization).repository.issues.pageInfo;
      this.onFetchFromGitHub(this.state.path, endCursor);
    }
  };

  onStarRepository: StarRepository = (repositoryId, viewerHasStarred) => {
    addStarToRepository(repositoryId).then(mutationResult =>
      this.setState(resolveAddStarMutation(mutationResult))
    );
  };

  onFetchFromGitHub = (path: string, cursor?: string) => {
    getIssuesOfRepository(path, cursor)
      .then((result: IQueryResult) => {
        if (result.data.errors) {
          this.setState(() => ({
            organization: null,
            errors: result.data.errors
          }));
        } else {
          this.setState(resolveIssuesQuery(result, this.state, cursor));
        }
      })
      .catch((err: AxiosError) => {
        this.setState(() => ({
          errors: [{ message: err.message }]
        }));
      });
  };

  render() {
    const { path, organization, errors } = this.state;

    return (
      <div>
        <h1>{TITLE}</h1>
        <form onSubmit={this.onSubmit}>
          <label htmlFor="url">Show open issues for https://github.com/</label>
          <input
            id="url"
            type="text"
            value={path}
            onChange={this.onChange}
            style={{ width: "300px" }}
          />
          <button type="submit">Search</button>
        </form>
        <hr />
        {organization || errors.length ? (
          <Organization
            organization={(organization as any) as IOrganization}
            errors={errors}
            onFetchMoreIssues={this.onFetchMoreIssues}
            onStarRepository={this.onStarRepository}
          />
        ) : (
          <p>No information yet ...</p>
        )}
      </div>
    );
  }
}

type OrganizationProps = {
  readonly organization: IOrganization;
  readonly errors: IError[];
  readonly onFetchMoreIssues: () => void;
  readonly onStarRepository: StarRepository;
};

const Organization: React.FunctionComponent<OrganizationProps> = ({
  organization,
  errors,
  onFetchMoreIssues,
  onStarRepository
}) => {
  if (errors && errors.length) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(" ")}
      </p>
    );
  }
  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization!.url}>{organization!.name}</a>
      </p>
      <Repository
        repository={organization!.repository}
        onFetchMoreIssues={onFetchMoreIssues}
        onStarRepository={onStarRepository}
      />
    </div>
  );
};

type RepositoryProps = {
  readonly repository: IRepository;
  readonly onFetchMoreIssues: () => void;
  readonly onStarRepository: StarRepository;
};

const Repository: React.FunctionComponent<RepositoryProps> = ({
  repository,
  onFetchMoreIssues,
  onStarRepository
}) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>
    <button
      type="button"
      onClick={() =>
        onStarRepository(repository.id, repository.viewerHasStarred)
      }
    >
      {repository.stargazers.totalCount}
      {repository.viewerHasStarred ? " Unstar" : " Star"}
    </button>
    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
          <ul>
            {issue.node.reactions.edges.map(reaction => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    <hr />
    {repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
);

export default App;
