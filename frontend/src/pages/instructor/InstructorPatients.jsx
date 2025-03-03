import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Box,
  Toolbar,
  Typography,
  Paper,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Switch,
  Tooltip,
  Avatar,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
 } from "@mui/material";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";
import {
  MRT_TableContainer,
  useMaterialReactTable,
} from "material-react-table";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import InstructorNewPatient from "./InstructorNewPatient";
import InstructorEditPatients from "./InstructorEditPatients";

function groupTitleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  const words = str.split(" ");
  return words
    .map((word, index) => {
      if (index === 0) {
        return word.toUpperCase(); // First word entirely in uppercase
      } else {
        return word.charAt(0).toUpperCase() + word.slice(1); // Only capitalize first letter, keep the rest unchanged
      }
    })
    .join(" ");
}

function titleCase(str) {
  if (typeof str !== "string") {
    return str;
  }
  return str
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1); // Capitalize only the first letter, leave the rest of the word unchanged
    })
    .join(" ");
}

const InstructorPatients = ({ groupName, simulation_group_id }) => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [openNewPatientDialog, setOpenNewPatientDialog] = useState(false);
  const [openEditPatientDialog, setOpenEditPatientDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [profilePictures, setProfilePictures] = useState({});
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [ingestionStatus, setIngestionStatus] = useState({});

  const handleExpandRow = async (patientId) => {
    if (expandedPatient === patientId) {
      setExpandedPatient(null); // Collapse if already expanded
      return;
    }

    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}instructor/ingestion_status?patient_id=${encodeURIComponent(
          patientId
        )}&simulation_group_id=${encodeURIComponent(simulation_group_id)}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const ingestionData = await response.json();
        setIngestionStatus((prev) => ({ ...prev, [patientId]: ingestionData }));
      } else {
        console.error("Failed to fetch ingestion status:", response.statusText);
        toast.error("Failed to fetch ingestion status");
      }
    } catch (error) {
      console.error("Error fetching ingestion status:", error);
    }

    setExpandedPatient(patientId);
  };

  // Toast function to display success messages
  const showSuccessToast = (message) => {
    toast.success(message, {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "colored",
    });
  };

  const handleSwitchChange = async (patientId, currentStatus) => {
    // Update the LLM Completion state in `data`
    setData((prevData) =>
      prevData.map((patient) =>
        patient.patient_id === patientId
          ? { ...patient, llm_completion: !currentStatus }
          : patient
      )
    );

    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;

      const response = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}instructor/toggle_llm_completion?patient_id=${encodeURIComponent(
          patientId
        )}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to update LLM completion status:", response.statusText);
        toast.error("Failed to update LLM completion status");
      }
    } catch (error) {
      console.error("Error updating LLM completion status:", error);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "patient_name",
        header: "Patient Name",
        Cell: ({ cell, row }) => (
          <Box display="flex" alignItems="center">
            <Avatar
              src={profilePictures[row.original.patient_id] || ""}
              alt={cell.getValue()}
              sx={{ marginRight: 1 }}
            />
            <Typography variant="body1">{titleCase(cell.getValue())}</Typography>
          </Box>
        ),
      },
      {
        accessorKey: "patient_age",
        header: "Age",
      },
      {
        accessorKey: "patient_gender",
        header: "Gender",
      },
      {
        accessorKey: "llm_completion",
        header: "LLM Completion",
        Cell: ({ row }) => (
          <Tooltip title="Turn on/off if the LLM evaluates the student">
            <Switch
              checked={row.original.llm_completion ?? false}
              onChange={() =>
                handleSwitchChange(row.original.patient_id, row.original.llm_completion)
              }
              color="primary"
            />
          </Tooltip>
        ),
      },
      {
        accessorKey: "actions",
        header: "Actions",
        Cell: ({ row }) => (
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleEditClick(row.original)}
          >
            Edit
          </Button>
        ),
      },
      {
        accessorKey: "ingestion_status",
        header: "Ingestion Status",
        Cell: ({ row }) => {
          const patientId = row.original.patient_id;
          const isExpanded = expandedPatient === patientId;
          const files = ingestionStatus[patientId] || {};

          return (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleExpandRow(patientId)}
              >
                {isExpanded ? "Hide" : "Check"}
              </Button>
              {isExpanded && (
                <TableContainer component={Paper} sx={{ marginTop: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>File</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(files).length > 0 ? (
                        Object.entries(files).map(([filename, status]) => (
                          <TableRow key={filename}>
                            <TableCell>{filename}</TableCell>
                            <TableCell>{status}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} align="center">
                            No files found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          );
        },
      },
    ],
    [profilePictures, expandedPatient, ingestionStatus]
  );

  const table = useMaterialReactTable({
    autoResetPageIndex: false,
    columns,
    data,
    enableRowOrdering: true,
    enableSorting: false,
    initialState: { pagination: { pageSize: 1000, pageIndex: 1 } },
    muiRowDragHandleProps: ({ table }) => ({
      onDragEnd: () => {
        const { draggingRow, hoveredRow } = table.getState();
        if (hoveredRow && draggingRow) {
          data.splice(
            hoveredRow.index,
            0,
            data.splice(draggingRow.index, 1)[0]
          );
          setData([...data]);
        }
      },
    }),
  });

  const fetchPatientsAndProfilePictures = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;

      // Fetch patient list
      const patientResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}instructor/view_patients?simulation_group_id=${encodeURIComponent(simulation_group_id)}`,
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );
      const patientData = await patientResponse.json();
      setData(patientData);

      // Fetch profile pictures
      const profileResponse = await fetch(
        `${import.meta.env.VITE_API_ENDPOINT}instructor/get_profile_pictures?simulation_group_id=${encodeURIComponent(simulation_group_id)}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ patient_ids: patientData.map((p) => p.patient_id) }),
        }
      );

      if (profileResponse.ok) {
        const profilePics = await profileResponse.json();
        setProfilePictures(profilePics);
      }
    } catch (error) {
      console.error("Error fetching patients or profile pictures:", error);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchPatientsAndProfilePictures();
  }, [simulation_group_id]);

  const handleEditClick = (patientData) => {
    setSelectedPatient(patientData);
    setOpenEditPatientDialog(true);
  };

  const handleCloseEditPatientDialog = () => {
    setSelectedPatient(null);
    setOpenEditPatientDialog(false);
    fetchPatientsAndProfilePictures(); // Refresh data after edit
  };

  const handleOpenNewPatientDialog = () => setOpenNewPatientDialog(true);
  const handleCloseNewPatientDialog = () => setOpenNewPatientDialog(false);

  const handleSaveChanges = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens.idToken;
      const { email } = await fetchUserAttributes();

      const updatePromises = data.map((patient, index) => {
        const patientNumber = index + 1;
        return fetch(
          `${
            import.meta.env.VITE_API_ENDPOINT
          }instructor/reorder_patient?patient_id=${encodeURIComponent(
            patient.patient_id
          )}&patient_number=${patientNumber}&instructor_email=${encodeURIComponent(
            email
          )}`,
          {
            method: "PUT",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              patient_name: patient.patient_name,
            }),
          }
        ).then((response) => {
          if (!response.ok) {
            console.error(
              `Failed to update patient ${patient.patient_id}:`,
              response.statusText
            );
            toast.error("Patient Order Update Failed", {
              position: "top-center",
              autoClose: 1000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: "colored",
            });
            return { success: false };
          } else {
            return response.json().then(() => {
              return { success: true };
            });
          }
        });
      });

      const updateResults = await Promise.all(updatePromises);
      const allUpdatesSuccessful = updateResults.every(
        (result) => result.success
      );

      if (allUpdatesSuccessful) {
        toast.success("Patient Order Updated Successfully", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } else {
        toast.error("Some patient updates failed", {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("An error occurred while saving changes", {
        position: "top-center",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    }
  };

  const onPatientCreated = async (newPatient) => {
    setData((prevData) => [...prevData, newPatient]);
    await fetchPatientsAndProfilePictures();
  };

  const onPatientUpdated = async () => {
    await fetchPatientsAndProfilePictures();
  };

  return (
    <Box
      component="main"
      sx={{ flexGrow: 1, p: 3, marginTop: 1, overflow: "auto" }}
    >
      <Toolbar />
      <Typography
        color="black"
        fontStyle="semibold"
        textAlign="left"
        variant="h6"
      >
        {groupTitleCase(groupName)}
      </Typography>
      <Paper sx={{ width: "100%", overflow: "hidden", marginTop: 2 }}>
        <Box sx={{ maxHeight: "400px", overflowY: "auto" }}>
          <MRT_TableContainer table={table} />
        </Box>
      </Paper>
      <Box
        sx={{
          marginTop: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={handleOpenNewPatientDialog}
        >
          Create New Patient
        </Button>

        <Dialog open={openNewPatientDialog} onClose={handleCloseNewPatientDialog} fullWidth maxWidth="md">
          <DialogTitle>Create New Patient</DialogTitle>
          <DialogContent style={{ overflow: "hidden" }}>
            <InstructorNewPatient
              data={data}
              simulation_group_id={simulation_group_id}
              onClose={handleCloseNewPatientDialog}
              onPatientCreated={onPatientCreated}
              showSuccessToast={showSuccessToast}
            />
          </DialogContent>
          {/* <DialogActions>
            <Button onClick={handleCloseNewPatientDialog} color="primary">
              Cancel
            </Button>
          </DialogActions> */}
        </Dialog>

        <Dialog open={openEditPatientDialog} onClose={handleCloseEditPatientDialog} fullWidth maxWidth="md">
          <DialogTitle>Edit Patient</DialogTitle>
          <DialogContent style={{ overflow: "hidden" }}>
            <InstructorEditPatients
              patientData={selectedPatient}
              simulation_group_id={simulation_group_id}
              onClose={handleCloseEditPatientDialog}
              onPatientUpdated={onPatientUpdated}
              showSuccessToast={showSuccessToast}
            />
          </DialogContent>
          {/* <DialogActions>
            <Button onClick={handleCloseEditPatientDialog} color="primary">
              Cancel
            </Button>
          </DialogActions> */}
        </Dialog>

        <Button variant="contained" color="primary" onClick={handleSaveChanges}>
          Save Changes
        </Button>
      </Box>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </Box>
  );
};

export default InstructorPatients;