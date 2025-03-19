import {
  Typography,
  Box,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  TableFooter,
  TablePagination,
} from "@mui/material";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";

// Helper function to create data and format text
const createData = (name, email) => {
  return { name, email };
};

function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const initialRows = [createData("loading...", "loading...")];

export const ViewStudents = ({ groupName, simulation_group_id }) => {
  const [rows, setRows] = useState(initialRows);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("loading...");
  const navigate = useNavigate();

  // Fetch access code and student data
  useEffect(() => {
    const fetchCode = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken;
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}instructor/get_access_code?simulation_group_id=${encodeURIComponent(
            simulation_group_id
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          }
        );
        if (response.ok) {
          const codeData = await response.json();
          setAccessCode(codeData.group_access_code);
        }
      } catch (error) {
        console.error("Error fetching access code:", error);
      }
    };
    fetchCode();
  }, [simulation_group_id]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens.idToken;
        const response = await fetch(
          `${import.meta.env.VITE_API_ENDPOINT}instructor/view_students?simulation_group_id=${encodeURIComponent(
            simulation_group_id
          )}`,
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
          const formattedData = data.map((student) => {
            return createData(
              `${titleCase(student.first_name)} ${titleCase(student.last_name)}`,
              student.user_email
            );
          });
          setRows(formattedData);
        } else {
          console.error("Failed to fetch students:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchStudents();
  }, [simulation_group_id]);

  const handleGenerateAccessCode = async () => {
    try {
      const session = await fetchAuthSession();
      var token = session.tokens.idToken;
      const response = await fetch(
        `${
          import.meta.env.VITE_API_ENDPOINT
        }instructor/generate_access_code?simulation_group_id=${encodeURIComponent(
          simulation_group_id
        )}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.ok) {
        const codeData = await response.json();
        setAccessCode(codeData.access_code);
      } else {
        console.error("Failed to fetch groups:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  // Handlers for pagination, searching, and navigation
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

  const handleRowClick = (student) => {
    localStorage.setItem("selectedStudent", JSON.stringify(student));
    localStorage.setItem("selectedGroupId", simulation_group_id);
    navigate(`/group/${groupName}/student/${student.name}`, {
      state: { simulation_group_id, student },
    });
  };

  const filteredRows = rows.filter((row) =>
    row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box component="main" sx={{ flexGrow: 1, p: 2, mt: 1, width: "100%", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Toolbar />
      <Typography variant="h6" sx={{ mb: 2 }}>
        {titleCase(groupName)} Students
      </Typography>
      <Paper sx={{ width: "100%", maxWidth: "1000px", overflow: "hidden", p: 2, mb: 2 }}>
        <TableContainer sx={{ maxHeight: "50vh", overflowY: "auto" }}>
          <TextField
            label="Search by Student"
            variant="outlined"
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{ mb: 2, width: "100%" }}
          />
          <Table aria-label="student table" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "50%" }}>Student</TableCell>
                <TableCell>Email</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.length > 0 ? (
                filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                  <TableRow key={index} onClick={() => handleRowClick(row)} sx={{ cursor: "pointer" }}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} align="center">
                    No students enrolled in this group
                  </TableCell>
                </TableRow>
              )}
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
      <Paper sx={{ p: 2, width: "100%", maxWidth: "1000px" }}>
        <Typography variant="subtitle1">Access Code: {accessCode}</Typography>
        <Button variant="contained" color="primary" onClick={handleGenerateAccessCode}>
          Generate New Access Code
        </Button>
      </Paper>
    </Box>
  );
};

export default ViewStudents;
