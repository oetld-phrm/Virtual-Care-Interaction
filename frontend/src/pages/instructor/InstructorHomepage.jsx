import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import {
  Typography,
  Box,
  AppBar,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  TableFooter,
  TablePagination,
  Button,
} from "@mui/material";
import PageContainer from "../Container";
import InstructorHeader from "../../components/InstructorHeader";
import InstructorSidebar from "./InstructorSidebar";
import InstructorAnalytics from "./InstructorAnalytics";
import InstructorEditPatients from "./InstructorEditPatients";
import PromptSettings from "./PromptSettings";
import ViewStudents from "./ViewStudents";
import InstructorPatients from "./InstructorPatients";
import InstructorNewPatient from "./InstructorNewPatient";
import StudentDetails from "./StudentDetails";
import { UserContext } from "../../App";
function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// group details page
const GroupDetails = () => {
  const { groupName } = useParams();
  const [selectedComponent, setSelectedComponent] = useState(
    "InstructorAnalytics"
  );
  const [simulationGroupId, setSimulationGroupId] = useState(localStorage.getItem("selectedGroupId") || null);

  useEffect(() => {
    if (!simulationGroupId) {
      const storedGroupId = localStorage.getItem("selectedGroupId");
      if (storedGroupId) {
        setSimulationGroupId(storedGroupId);
      }
    }
  }, []);

  if (!simulationGroupId) {
    return <Typography variant="h6">Loading ...</Typography>;
  }

  const renderComponent = () => {
    switch (selectedComponent) {
      case "InstructorAnalytics":
        return (
          <InstructorAnalytics groupName={groupName} simulation_group_id={simulationGroupId} />
        );
      case "InstructorEditPatients":
        return (
          <InstructorPatients groupName={groupName} simulation_group_id={simulationGroupId} />
        );
      case "PromptSettings":
        return <PromptSettings groupName={groupName} simulation_group_id={simulationGroupId} />;
      case "ViewStudents":
        return <ViewStudents groupName={groupName} simulation_group_id={simulationGroupId} />;
      default:
        return (
          <InstructorAnalytics groupName={groupName} simulation_group_id={simulationGroupId} />
        );
    }
  };

  return (
    <PageContainer>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        elevation={1}
      >
        <InstructorHeader />
      </AppBar>
      <InstructorSidebar setSelectedComponent={setSelectedComponent} />
      {renderComponent()}
    </PageContainer>
  );
};

const InstructorHomepage = () => {
  const [rows, setRows] = useState([
    {
      group: "loading...",
      description: "loading...",
      date: "loading...",
      status: "loading...",
      id: "loading...",
    },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [groupData, setGroupData] = useState([]);
  const { isInstructorAsStudent } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isInstructorAsStudent) {
      navigate("/");
    }
  }, [isInstructorAsStudent, navigate]);
  // connect to api data
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const session = await fetchAuthSession();
        var token = session.tokens.idToken
        const { email } = await fetchUserAttributes();
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT
          }instructor/groups?email=${encodeURIComponent(email)}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setGroupData(data);
          console.log(data)
          const formattedData = data.map((group) => ({
            group: group.group_name,
            description: group.group_description || "No description available",
            date: new Date().toLocaleDateString(), // REPLACE
            status: group.group_student_access ? "Active" : "Inactive",
            id: group.simulation_group_id,
            access_code: group.group_access_code,
          }));
          setRows(formattedData);
        } else {
          console.error("Failed to fetch groups:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching groups:", error);
      }
    };

    fetchGroups();
  }, []);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const filteredRows = rows.filter((row) =>
    row.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRowClick = (groupName, simulation_group_id) => {
    localStorage.setItem("selectedGroupId", simulation_group_id);
    const group = groupData.find(
      (group) => group.group_name.trim() === groupName.trim()
    );

    if (group) {
      const { simulation_group_id } = group;
      const path = `/group/ ${groupName.trim()}`;
      navigate(path, { state: { simulation_group_id } });
    } else {
      console.error("Group not found!");
    }
  };


  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageContainer>
            <AppBar
              position="fixed"
              sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
              elevation={1}
            >
              <InstructorHeader />
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, p: 3, marginTop: 1, overflowY: "auto", maxHeight: "calc(100vh - 64px)" }}>
              <Toolbar />
              <Typography
                color="black"
                fontStyle="semibold"
                textAlign="left"
                variant="h6"
              >
                Simulation Groups
              </Typography>
              <Paper
                sx={{
                  width: "80%",
                  margin: "0 auto",
                  padding: 2,
                }}
              >
                <TextField
                  label="Search by Group"
                  variant="outlined"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  sx={{ width: "100%", marginBottom: 2 }}
                />
                <TableContainer>
                  <Table aria-label="group table">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "40%", padding: "16px" }}>
                          Group
                        </TableCell>
                        <TableCell sx={{ width: "20%", padding: "16px" }}>
                        Group Access Code
                        </TableCell>
                        <TableCell sx={{ width: "30%", padding: "16px" }}>
                          Description
                        </TableCell>
                        <TableCell sx={{ width: "10%", padding: "16px" }}>
                          Status
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((row, index) => (
                          <TableRow
                            key={index}
                            style={{
                              transition: "background-color 0.3s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                          >
                            <TableCell
                            onClick={() => handleRowClick(row.group, row.id)}
                            style={{
                              cursor:"pointer",
                            }}
                            sx={{ padding: "16px" }}>
                              {titleCase(row.group)}
                            </TableCell>
                            <TableCell sx={{ padding: "16px" }}>
                            {row.access_code}
                            </TableCell>
                            <TableCell sx={{ padding: "16px" }}>
                              {row.description}
                            </TableCell>
                            <TableCell sx={{ padding: "16px" }}>
                              <Button
                                variant="contained"
                                color={row.status === "Active" ? "primary" : "secondary"}
                              >
                                {row.status}
                              </Button>
                            </TableCell>
                          </TableRow>

                        ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TablePagination
                          rowsPerPageOptions={[5, 10, 25]}
                          component="div"
                          count={filteredRows.length}
                          rowsPerPage={rowsPerPage}
                          page={page}
                          onPageChange={handleChangePage}
                          onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          </PageContainer>
        }
      />
      <Route exact path=":groupName/*" element={<GroupDetails />} />
      <Route
        path=":groupName/edit-patient"
        element={<InstructorEditPatients />}
      />
      <Route path=":groupName/new-patient" element={<InstructorNewPatient />} />
      <Route
        path=":groupName/student/:studentId"
        element={<StudentDetails />}
      />
    </Routes>
  );
};

export default InstructorHomepage; 