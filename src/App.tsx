import axios, { AxiosError } from "axios";
import React, { Component } from "react";

const axiosGitHubGraphQL = axios.create({
  baseURL: "https://api.github.com/graphql",
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`
  }
});

const GET_ORGANIZATION = `
{
  organization(login: "the-road-to-learn-react") {
    name
    url
  }
}
`;

const TITLE = "React GraphQL GitHub Client";

type IOrganization = {
  readonly name: string;
  readonly url: string;
} | null;

type IError = {
  message: string;
};

type AppState = {
  readonly path: string;
  readonly organization: IOrganization;
  readonly errors: IError[];
};
class App extends Component<{}, AppState> {
  state = {
    path: "the-road-to-learn-react/the-road-to-learn-react",
    organization: null,
    errors: []
  };
  componentDidMount() {
    this.onFetchFromGitHub();
  }
  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ path: event.target.value });
  };
  onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // fetch data
    event.preventDefault();
  };

  onFetchFromGitHub = () => {
    axiosGitHubGraphQL
      .post("", { query: GET_ORGANIZATION })
      .then(result =>
        this.setState(() => ({
          organization: result.data.data.organization,
          errors: result.data.errors
        }))
      )
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
        {organization ? (
          <Organization organization={organization} errors={errors} />
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
};

const Organization: React.FunctionComponent<OrganizationProps> = ({
  organization,
  errors
}) => {
  if (errors) {
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
    </div>
  );
};

export default App;
